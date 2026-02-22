const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { readConfig } = require('../services/llm-config');
const { injectRunnerFlags } = require('./runner-registry');
const { injectStreamFlags, createStreamProcessor } = require('./stream-parser');
const {
  buildDirPath,
  readBuildMeta,
  getBuildDocs,
} = require('../services/tasks-store');
const { parseFileBlocks, parseCommandTemplate } = require('./planner');

/**
 * Build a feedback prompt that sends all current build docs as context
 * along with the user's feedback message, asking the runner to output
 * only the modified files using the --- FILE: X.md --- separator format.
 */
function buildFeedbackPrompt({ buildId, buildType, buildStatus, message, docs }) {
  const docEntries = Object.entries(docs).filter(([, content]) => content);

  const docsContext = docEntries.map(([name, content]) => {
    return `--- CURRENT FILE: ${name} ---\n${content}`;
  }).join('\n\n');

  // Inform the runner about doc restrictions per build type
  const docRestrictions = buildType === 'vibe'
    ? 'This is a Vibe (quick fix) build. Only GOAL.md and TASKS.md are allowed.'
    : buildType === 'lite'
      ? 'This is a Lite build. Documents allowed: GOAL.md, TASKS.md, RECAP.md.'
      : 'This is a Full build. All documents are allowed: GOAL.md, PLAN.md, DESIGN.md, TASKS.md, REVIEW.md, SHIP.md, RECAP.md, DECISIONS.md, TEST_PLAN.md.';

  return [
    'FEEDBACK REQUEST FOR BUILD DOCUMENTS',
    '',
    'CONTEXT:',
    `Build ID: ${buildId}`,
    `Build type: ${buildType || 'vibe'}`,
    `Build status: ${buildStatus || 'planning'}`,
    docRestrictions,
    '',
    'The user wants to modify the build documents based on their message below.',
    'Current build documents:',
    '',
    docsContext,
    '',
    '--- END OF CURRENT DOCUMENTS ---',
    '',
    'USER MESSAGE:',
    message,
    '',
    'INSTRUCTIONS:',
    'Your response has TWO parts:',
    '',
    'PART 1 — SUMMARY (required):',
    'Start with 1-3 sentences explaining what you changed and why, in a helpful conversational tone.',
    'If no changes are needed, explain why. This text goes BEFORE any file separators.',
    '',
    'PART 2 — FILE BLOCKS (only if files need changes):',
    'After your summary, output the modified files using the separator format below.',
    '',
    '--- FILE: FILENAME.md ---',
    '(full updated content of the file)',
    '',
    'RULES:',
    '- Always start with the conversational summary before any --- FILE: separators.',
    '- Only output files that actually changed.',
    '- Preserve the structure and format of each document.',
    '- For TASKS.md: every task Status MUST be valid (pending, planning, in_progress, review, deployed, blocked).',
    '- If you need clarification, include questions in GOAL.md under "## Open Questions" and proceed with your best guess.',
    `- ${docRestrictions}`,
    '',
    'Respond now.',
  ].join('\n');
}

/**
 * Extract conversational text that appears before the first --- FILE: separator.
 */
function extractConversationalResponse(fullOutput) {
  const firstSep = fullOutput.search(/---\s*FILE:\s*[A-Z_]+\.md\s*---|<!--\s*FILE:\s*[A-Z_]+\.md\s*-->/i);
  if (firstSep <= 0) {
    // No file blocks found — the entire output might be conversational
    const cleaned = fullOutput
      .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '') // strip ANSI
      .trim();
    return cleaned.length > 0 && cleaned.length < 2000 ? cleaned : '';
  }

  const before = fullOutput.slice(0, firstSep)
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '') // strip ANSI
    .trim();

  return before || '';
}

/**
 * Run a feedback cycle — takes user feedback, sends it with all current
 * build docs to the CLI runner, parses the output, and writes updated files.
 *
 * Mirrors the runPlanning pattern: temp file → stdin pipe → SSE streaming → parse → write.
 */
async function runFeedback({ buildId, message, eventBus }) {
  const meta = await readBuildMeta(buildId);
  if (!meta) {
    throw new Error(`Build ${buildId} not found`);
  }

  // Read all current build docs
  const docs = await getBuildDocs(buildId);

  // Resolve runner
  const config = await readConfig({ withSecrets: true });
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

  const projectRoot = meta.projectRoot || process.cwd();
  const processId = `feedback-${buildId}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  let chunkIndex = 0;
  const activityItems = [];

  // Build the feedback prompt with all docs as context
  const feedbackPrompt = buildFeedbackPrompt({
    buildId,
    buildType: meta.buildType || 'vibe',
    buildStatus: meta.status || 'planning',
    message,
    docs,
  });

  // Write prompt to temp file
  const uid = crypto.randomBytes(4).toString('hex');
  const tmpDir = os.tmpdir();
  const promptFile = path.join(tmpDir, `vibe-feedback-${buildId}-${uid}.txt`);
  await fs.writeFile(promptFile, feedbackPrompt, 'utf8');

  // Parse the command template
  const template = runnerConfig.commandTemplate || '';
  const { args: cmdArgs } = parseCommandTemplate(template);

  if (cmdArgs.length === 0) {
    await fs.unlink(promptFile).catch(() => {});
    throw new Error(`Runner ${runnerName} has an empty command template`);
  }

  // Inject runner-specific model flag via registry (no permission flags for feedback — read-only)
  const modelPrefs = config.modelPreferences?.feedback;
  const modelPref = typeof modelPrefs === 'object' ? modelPrefs[runnerName] : (typeof modelPrefs === 'string' ? modelPrefs : null);
  injectRunnerFlags(runnerName, cmdArgs, { modelPref });

  // Inject stream-json flags for runners that support real-time streaming
  const isStreamJson = injectStreamFlags(runnerName, cmdArgs);

  const log = (stream, msg) => {
    chunkIndex += 1;
    const ts = new Date().toISOString();
    eventBus.broadcast(buildId, 'execution-log', {
      buildId,
      taskId: null,
      stream,
      message: msg,
      processId,
      processType: 'feedback',
      phase: 'feedback',
      chunkIndex,
      timestamp: ts,
    });

    // Collect structured activity items for the chat message
    if (stream === 'system' && typeof msg === 'string' && msg.startsWith('\n\u2500\u2500')) {
      activityItems.push({ type: 'tool-use', detail: msg.trim(), timestamp: ts });
    } else if (stream === 'success' && typeof msg === 'string' && msg.includes('$')) {
      activityItems.push({ type: 'cost', detail: msg.trim(), timestamp: ts });
    } else if (stream === 'error' || stream === 'stderr') {
      activityItems.push({ type: 'error', detail: String(msg).trim(), timestamp: ts });
    }
  };

  log('system', `Running feedback with ${runnerName}...`);

  // Spawn: cat <promptFile> | <runner> <flags>
  const shellCmd = `cat ${JSON.stringify(promptFile)} | ${cmdArgs.map(a => JSON.stringify(a)).join(' ')}`;

  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-lc', shellCmd], {
      cwd: projectRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Stream all runner output to the terminal — same pattern as runPlanning.
    // The user sees the full CLI output just like in Claude Code or Codex terminal.
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
      const text = String(chunk);
      log('stderr', text);
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

        // Parse the output into file blocks
        const fileBlocks = parseFileBlocks(fullOutput);
        const dir = buildDirPath(buildId);
        await fs.mkdir(dir, { recursive: true });

        const updatedFiles = [];

        for (const [fileName, content] of Object.entries(fileBlocks)) {
          const filePath = path.join(dir, fileName);
          await fs.writeFile(filePath, content, 'utf8');
          updatedFiles.push(fileName);
        }

        if (updatedFiles.length === 0) {
          log('system', 'No changes needed.');
        } else {
          log('success', `Updated ${updatedFiles.join(', ')}`);
          for (const f of updatedFiles) {
            activityItems.push({ type: 'file-updated', detail: f, timestamp: new Date().toISOString() });
          }
        }

        resolve({
          buildId,
          updatedFiles,
          conversationalResponse,
          activity: activityItems,
        });
      } catch (err) {
        log('error', `Failed to process feedback output: ${err.message}`);
        reject(err);
      }
    });
  });
}

module.exports = {
  runFeedback,
  extractConversationalResponse,
};
