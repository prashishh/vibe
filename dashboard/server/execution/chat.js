'use strict';

const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { readConfig } = require('../services/llm-config');
const { injectRunnerFlags } = require('./runner-registry');
const { resolveRunnerPathPrefix } = require('./runner');
const { injectStreamFlags, createStreamProcessor } = require('./stream-parser');
const processRegistry = require('./process-registry');
const {
  buildDirPath,
  readBuildMeta,
  getBuildDocs,
} = require('../services/tasks-store');
const { parseFileBlocks, parseCommandTemplate } = require('./planner');
const { extractConversationalResponse } = require('./feedback');

// ─────────────────────────────────────────────────────────────────────────────
// Framework knowledge base — injected into every chat prompt so the CLI runner
// understands vibe cycles, docs, task structure, and commands.
// ─────────────────────────────────────────────────────────────────────────────

const FRAMEWORK_KNOWLEDGE = `
## Vibe Framework

### Build Types
- **Vibe (Quick Fix)**: 1-3 tasks, low risk. Creates GOAL.md + TASKS.md only.
- **Lite Build**: 3-8 tasks, low-medium risk. Creates GOAL.md + TASKS.md + RECAP.md.
- **Full Build**: 8+ tasks or high risk. Creates GOAL.md + PLAN.md + DESIGN.md + TASKS.md + REVIEW.md + SHIP.md + RECAP.md. May also create DECISIONS.md, TEST_PLAN.md.

### Build Lifecycle
pending (backlog) -> planning (agent reads code + generates docs) -> in_progress (tasks executed) -> review -> deployed (shipped)
Builds can also be "blocked" (stalled, needs human input).

### Documents
Only these are allowed: GOAL.md, TASKS.md, RECAP.md, PLAN.md, DESIGN.md, REVIEW.md, SHIP.md, DECISIONS.md, TEST_PLAN.md.
- GOAL.md: Intent, success metric, scope (in/out), guard impact
- TASKS.md: Task list with IDs (T-01, T-02..), outcome, risk, status, acceptance criteria, files
- PLAN.md: Detailed implementation plan per task (Full builds only)
- DESIGN.md: Architecture decisions, schema, API contracts (Full builds only)
- RECAP.md: Post-build summary, what shipped, metrics

### Task Structure
Each task has: ID (T-01), title, outcome, risk (Low/Medium/High/Critical), status (pending/planning/in_progress/review/deployed/blocked), acceptance criteria (checkboxes), files affected.

### Guards
Permanent, append-only rules the agent must never break. Checked after every build. Examples: "Never drop a database table", "Always use migrations".

### Commands
/new <desc> — Create a cycle | /plan — Start planning | /build — Start building | /review — Move to review | /ship — Deploy | /status — Show info | /list — List all cycles | /clear — Clear messages
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Build the chat prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildChatPrompt({ message, buildId, buildType, buildStatus, docs, chatHistory }) {
  const parts = [];

  parts.push('You are the Vibe assistant — a helpful AI that understands the Vibe software delivery framework.');
  parts.push('');
  parts.push(FRAMEWORK_KNOWLEDGE);
  parts.push('');

  // Build context (if a build is selected)
  if (buildId) {
    const docRestrictions = buildType === 'vibe'
      ? 'This is a Vibe (quick fix) build. Only GOAL.md and TASKS.md are allowed.'
      : buildType === 'lite'
        ? 'This is a Lite build. Documents allowed: GOAL.md, TASKS.md, RECAP.md.'
        : 'This is a Full build. All documents are allowed: GOAL.md, PLAN.md, DESIGN.md, TASKS.md, REVIEW.md, SHIP.md, RECAP.md, DECISIONS.md, TEST_PLAN.md.';

    parts.push('CURRENT BUILD CONTEXT:');
    parts.push(`Build ID: ${buildId}`);
    parts.push(`Build type: ${buildType || 'vibe'}`);
    parts.push(`Build status: ${buildStatus || 'planning'}`);
    parts.push(docRestrictions);
    parts.push('');

    // Include build docs
    const docEntries = Object.entries(docs || {}).filter(([, content]) => content);
    if (docEntries.length > 0) {
      parts.push('Current build documents:');
      parts.push('');
      for (const [name, content] of docEntries) {
        parts.push(`--- CURRENT FILE: ${name} ---`);
        parts.push(content);
        parts.push('');
      }
      parts.push('--- END OF CURRENT DOCUMENTS ---');
      parts.push('');
    }
  } else {
    parts.push('No build is currently selected.');
    parts.push('');
  }

  // Chat history for multi-turn context
  if (chatHistory && chatHistory.length > 0) {
    parts.push('RECENT CONVERSATION:');
    for (const msg of chatHistory) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      parts.push(`${role}: ${msg.content}`);
    }
    parts.push('');
  }

  // User message
  parts.push('USER MESSAGE:');
  parts.push(message);
  parts.push('');

  // Instructions
  if (buildId) {
    parts.push('INSTRUCTIONS:');
    parts.push('Respond to the user naturally. You can:');
    parts.push('- Answer questions about the build, framework, or anything else conversationally.');
    parts.push('- If the user wants to modify build documents, output the changed files using this format:');
    parts.push('');
    parts.push('--- FILE: FILENAME.md ---');
    parts.push('(full updated content of the file)');
    parts.push('');
    parts.push('RULES:');
    parts.push('- Always start with a conversational response before any --- FILE: separators.');
    parts.push('- Only output file blocks if documents actually need changes.');
    parts.push('- Preserve the structure and format of each document.');
    parts.push('- For TASKS.md: every task Status MUST be valid (pending, planning, in_progress, review, deployed, blocked).');
  } else {
    parts.push('INSTRUCTIONS:');
    parts.push('Respond conversationally. Help the user with questions about the Vibe framework, their project, or anything else.');
    parts.push('If the user describes something they want to BUILD (a feature, page, component, etc.), output exactly this on its own line:');
    parts.push('BUILD_INTENT: <a concise description of what they want to build>');
    parts.push('Then follow it with a brief conversational response about how you will help.');
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Run a chat message through the CLI runner
// ─────────────────────────────────────────────────────────────────────────────

async function runChat({ buildId, message, chatHistory, eventBus }) {
  // Read build meta + docs if buildId provided
  let meta = null;
  let docs = {};

  if (buildId) {
    meta = await readBuildMeta(buildId);
    if (meta) {
      docs = await getBuildDocs(buildId);
    }
  }

  // Resolve runner
  const config = await readConfig();
  const exec = config.execution || {};
  const runners = exec.runners || {};
  const preferred = exec.preferredRunner || 'claude';

  const ordered = [
    preferred,
    ...Object.keys(runners).filter(name => name !== preferred),
  ];

  let runnerName = null;
  let runnerConfig = null;
  for (const name of ordered) {
    const runner = runners[name];
    if (runner && runner.enabled === true && runner.commandTemplate) {
      runnerName = name;
      runnerConfig = runner;
      break;
    }
  }

  if (!runnerName || !runnerConfig) {
    throw new Error('No enabled CLI runner found. Configure a runner in Settings.');
  }

  const projectRoot = meta?.projectRoot || process.cwd();
  const processId = `chat-${buildId || 'general'}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  let chunkIndex = 0;
  const activityItems = [];

  // Build the chat prompt
  const chatPrompt = buildChatPrompt({
    message,
    buildId,
    buildType: meta?.buildType || 'vibe',
    buildStatus: meta?.status || 'planning',
    docs,
    chatHistory,
  });

  // Write prompt to temp file
  const uid = crypto.randomBytes(4).toString('hex');
  const tmpDir = os.tmpdir();
  const promptFile = path.join(tmpDir, `vibe-chat-${buildId || 'general'}-${uid}.txt`);
  await fs.writeFile(promptFile, chatPrompt, 'utf8');

  // Parse command template
  const template = runnerConfig.commandTemplate || '';
  const { args: cmdArgs } = parseCommandTemplate(template);

  if (cmdArgs.length === 0) {
    await fs.unlink(promptFile).catch(() => {});
    throw new Error(`Runner ${runnerName} has an empty command template`);
  }

  // Inject model + permission flags (use feedback model preference — same model that handles chat)
  const modelPrefs = config.modelPreferences?.feedback;
  const modelPref = typeof modelPrefs === 'object' ? modelPrefs[runnerName] : (typeof modelPrefs === 'string' ? modelPrefs : null);
  injectRunnerFlags(runnerName, cmdArgs, {
    modelPref,
    permissionMode: exec.permissionMode || 'bypassPermissions',
  });

  // Inject stream-json flags for runners that support real-time streaming
  const isStreamJson = injectStreamFlags(runnerName, cmdArgs);

  // Logging helper — broadcasts SSE events if eventBus is provided
  const log = (stream, msg) => {
    if (!eventBus || !buildId) return;
    chunkIndex += 1;
    const ts = new Date().toISOString();
    eventBus.broadcast(buildId, 'execution-log', {
      buildId,
      taskId: null,
      stream,
      message: msg,
      processId,
      processType: 'chat',
      phase: 'chat',
      chunkIndex,
      timestamp: ts,
    });

    // Collect structured activity items
    if (stream === 'system' && typeof msg === 'string' && msg.startsWith('\n\u2500\u2500')) {
      activityItems.push({ type: 'tool-use', detail: msg.trim(), timestamp: ts });
    } else if (stream === 'success' && typeof msg === 'string' && msg.includes('$')) {
      activityItems.push({ type: 'cost', detail: msg.trim(), timestamp: ts });
    } else if (stream === 'error' || stream === 'stderr') {
      activityItems.push({ type: 'error', detail: String(msg).trim(), timestamp: ts });
    }
  };

  log('system', `Chat with ${runnerName}...`);

  // Spawn: cat <promptFile> | <runner> <flags>
  // Prepend PATH fix so the runner's Node version is found first (fixes nvm mismatches).
  const pathPrefix = resolveRunnerPathPrefix(cmdArgs[0]);
  const shellCmd = `${pathPrefix}cat ${JSON.stringify(promptFile)} | ${cmdArgs.map(a => JSON.stringify(a)).join(' ')}`;

  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-lc', shellCmd], {
      cwd: projectRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Register for cancellation tracking
    processRegistry.register(processId, {
      child,
      buildId: buildId || 'general',
      type: 'chat',
      promptFile,
    });

    const stream = createStreamProcessor({
      runnerName,
      isStreamJson,
      onText: (delta) => log('stdout', delta),
      onChunk: (delta, streamType) => log(streamType || 'stdout', delta),
      onError: (msg) => log('error', msg),
    });

    child.stdout.on('data', (chunk) => {
      stream.processChunk(chunk);
    });

    child.stderr.on('data', (chunk) => {
      log('stderr', String(chunk));
    });

    child.on('error', (err) => {
      log('error', `Runner failed to start: ${err.message}`);
      cleanup();
      reject(new Error(`Runner failed to start: ${err.message}`));
    });

    const cleanup = async () => {
      await fs.unlink(promptFile).catch(() => {});
    };

    child.on('exit', async (code) => {
      stream.flush();
      const fullOutput = stream.getFullOutput();
      await cleanup();

      if (code !== 0) {
        log('error', `Runner exited with code ${code}`);
        reject(new Error(`Runner exited with code ${code}`));
        return;
      }

      try {
        // Extract conversational response (text before first --- FILE: separator)
        const conversationalResponse = extractConversationalResponse(fullOutput);

        // Check for build intent (no-build chat only)
        let buildIntent = null;
        if (!buildId) {
          const intentMatch = fullOutput.match(/BUILD_INTENT:\s*(.+)/i);
          if (intentMatch) {
            buildIntent = intentMatch[1].trim();
          }
        }

        // Parse file blocks and write them (build chat only)
        const updatedFiles = [];
        if (buildId) {
          const fileBlocks = parseFileBlocks(fullOutput);
          const dir = buildDirPath(buildId);
          await fs.mkdir(dir, { recursive: true });

          for (const [fileName, content] of Object.entries(fileBlocks)) {
            const filePath = path.join(dir, fileName);
            await fs.writeFile(filePath, content, 'utf8');
            updatedFiles.push(fileName);
          }

          if (updatedFiles.length > 0) {
            log('success', `Updated ${updatedFiles.join(', ')}`);
            for (const f of updatedFiles) {
              activityItems.push({ type: 'file-updated', detail: f, timestamp: new Date().toISOString() });
            }
          }
        }

        resolve({
          buildId,
          conversationalResponse,
          updatedFiles,
          buildIntent,
          activity: activityItems,
        });
      } catch (err) {
        log('error', `Failed to process chat output: ${err.message}`);
        reject(err);
      }
    });
  });
}

module.exports = {
  runChat,
  FRAMEWORK_KNOWLEDGE,
};
