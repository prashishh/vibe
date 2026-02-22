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
  writeBuildMeta,
  getTasks,
} = require('../services/tasks-store');

/**
 * Map build type to Vibe skill command.
 *
 *   lite  → /lite  (3-8 tasks, creates GOAL, TASKS, RECAP)
 *   full  → /full  (8+ tasks, creates GOAL, PLAN, DESIGN, TASKS, REVIEW, SHIP, RECAP)
 *   vibe  → /vibe  (1-3 tasks, quick fix — no build docs)
 */
function skillForBuildType(buildType) {
  switch (buildType) {
    case 'full':
      return { skill: '/full', label: 'Full Build' };
    case 'vibe':
      return { skill: '/vibe', label: 'Vibe (Quick Fix)' };
    case 'lite':
    default:
      return { skill: '/lite', label: 'Lite Build' };
  }
}

/**
 * Build the planning prompt that invokes the proper Vibe skill.
 *
 * Instead of a raw "generate these files" prompt, we tell the runner
 * to follow the skill's planning workflow — reading core/VIBE.md,
 * .vibe/GUARDS.md, templates, etc. — then output the build documents
 * as text blocks we can parse and write.
 */
function buildSkillPrompt({ buildId, buildType, description, projectRoot }) {
  const { skill, label } = skillForBuildType(buildType);
  const isVibe = buildType === 'vibe';
  const isLite = buildType === 'lite' || buildType === undefined;
  const isFull = buildType === 'full';

  // For /vibe quick-fixes we don't create build docs —
  // just a simple task list
  if (isVibe) {
    return [
      `${skill} ${description}`,
      '',
      'IMPORTANT CONTEXT:',
      `- Build ID: ${buildId}`,
      `- Project root: ${projectRoot}`,
      `- Build directory: .vibe/builds/${buildId}/`,
      '',
      'INSTRUCTIONS:',
      'You are running a Vibe quick fix. Follow the /vibe workflow:',
      '',
      '1. Viability check — confirm this is 1-3 tasks, low risk, no core behavior change.',
      '2. If it qualifies, plan the implementation steps.',
      '3. If it does NOT qualify, say so and recommend /lite or /full instead.',
      '',
      'Since this is a non-interactive planning session, do NOT actually implement anything.',
      'Instead, output the plan as build documents using the separator format below.',
      '',
      'OUTPUT FORMAT (use EXACTLY these separators):',
      '',
      '--- FILE: GOAL.md ---',
      '(A brief goal statement for this vibe fix)',
      '',
      '--- FILE: TASKS.md ---',
      `# Build ${buildId} Tasks`,
      '',
      'Status key: `pending`, `planning`, `in_progress`, `review`, `deployed`, `blocked`',
      '',
      '## Task List',
      '',
      '### T-01: (title)',
      '- **Outcome**: (what this delivers)',
      '- **Risk**: Low',
      '- **Status**: pending',
      '- **Acceptance**:',
      '  - [ ] (criteria)',
      '- **Files**: (files to modify)',
      '',
      'CRITICAL: Every task Status MUST be "pending". Do NOT use "done", "complete", or "finished".',
      '',
      'CRITICAL RULES:',
      '- You MUST always output the files using the --- FILE: X.md --- separator format above.',
      '- NEVER output conversational text without the file separators — the output is machine-parsed.',
      '- If you have questions, include them in GOAL.md under "## Open Questions" and proceed with your best guess.',
      '- Do NOT ask questions instead of producing documents. Always produce the documents.',
      '',
      'Generate the documents now.',
    ].join('\n');
  }

  // For /lite and /full — full planning workflow
  const docsLite = 'GOAL.md, TASKS.md, RECAP.md';
  const docsFull = 'GOAL.md, PLAN.md, DESIGN.md, TASKS.md, REVIEW.md, SHIP.md, RECAP.md';
  const docs = isFull ? docsFull : docsLite;

  const tasksFormat = isLite
    ? [
        '### T-01: (title)',
        '- **Outcome**: (what this task delivers)',
        '- **Risk**: Low | Medium | High | Critical',
        '- **Status**: pending',
        '- **Acceptance**:',
        '  - [ ] (checkable condition 1)',
        '  - [ ] (checkable condition 2)',
        '- **Files**: (primary files affected)',
      ].join('\n')
    : [
        '| Task | Title | Risk | Status |',
        '|------|-------|------|--------|',
        '| T-01 | (title) | (risk) | pending |',
      ].join('\n');

  const fullDocsNote = isFull
    ? [
        '',
        'For the Full Build, also create these additional documents:',
        '- PLAN.md — detailed implementation plan with rollback strategies per task',
        '- DESIGN.md — architecture decisions, schema changes, API contracts',
        '- REVIEW.md — placeholder with TBD sections for review findings',
        '- SHIP.md — deployment checklist with pre/post deployment steps',
      ].join('\n')
    : '';

  return [
    `${skill} ${description}`,
    '',
    'IMPORTANT CONTEXT:',
    `- Build ID: ${buildId}`,
    `- Project root: ${projectRoot}`,
    `- Build directory: .vibe/builds/${buildId}/`,
    `- Build type: ${label}`,
    '',
    'INSTRUCTIONS:',
    `You are running the Vibe ${skill} skill for planning.`,
    `Follow the ${skill} workflow:`,
    '',
    '1. READ the project context:',
    '   - Read core/VIBE.md if it exists (the project\'s vibe contract)',
    '   - Read .vibe/GUARDS.md if it exists (guard rails)',
    '   - Read the latest builds/v*/RECAP.md if any exist (past build context)',
    '   - Scan the codebase to understand the project structure',
    '',
    '2. BRAINSTORM & PLAN (since this is non-interactive, use your best judgment):',
    '   - Determine scope boundaries (what\'s in vs out)',
    '   - Define success criteria',
    '   - Identify risk areas',
    '   - Choose the best architecture approach if multiple options exist',
    '',
    '3. CREATE BUILD DOCUMENTS:',
    `   Generate these files: ${docs}`,
    '',
    '   For GOAL.md, include:',
    '   - Intent (what and why, 1-2 sentences)',
    '   - Success Metric (specific, measurable outcomes)',
    '   - Scope (In / Out bullet lists)',
    '   - Guard Impact (which guards this build affects)',
    '',
    `   For TASKS.md, use this format (${isLite ? '3-8 tasks for Lite' : '8+ tasks for Full'}):`,
    `   # Build ${buildId} Tasks`,
    '',
    '   Status key: `pending`, `planning`, `in_progress`, `review`, `deployed`, `blocked`',
    '',
    '   ## Task List',
    '',
    tasksFormat,
    '',
    '   For RECAP.md, create a template with TBD placeholders for metrics.',
    '',
    '   CRITICAL: Every task Status MUST be "pending". Do NOT use "done", "complete", or "finished".',
    fullDocsNote,
    '',
    '4. STOP after presenting the plan — do NOT execute any tasks.',
    '',
    'OUTPUT FORMAT:',
    'Output each document using EXACTLY this separator pattern (critical for parsing):',
    '',
    '--- FILE: GOAL.md ---',
    '(full GOAL.md content)',
    '',
    '--- FILE: TASKS.md ---',
    '(full TASKS.md content)',
    '',
    '--- FILE: RECAP.md ---',
    '(full RECAP.md content)',
    '',
    isFull ? [
      '--- FILE: PLAN.md ---',
      '(full PLAN.md content)',
      '',
      '--- FILE: DESIGN.md ---',
      '(full DESIGN.md content)',
      '',
      '--- FILE: REVIEW.md ---',
      '(full REVIEW.md content)',
      '',
      '--- FILE: SHIP.md ---',
      '(full SHIP.md content)',
    ].join('\n') : '',
    '',
    'CRITICAL RULES:',
    '- You MUST always output the files using the --- FILE: X.md --- separator format above.',
    '- NEVER output conversational text without the file separators — the output is machine-parsed.',
    '- If you have clarifying questions, include them in a "## Open Questions" section inside GOAL.md,',
    '  then proceed with your best-guess plan. The user can refine via chat afterward.',
    '- Do NOT ask questions instead of producing documents. Always produce the documents.',
    '',
    'Generate all documents now. Be thorough but concise.',
    'Read the project files first to produce a plan grounded in the actual codebase.',
  ].join('\n');
}

/**
 * Parse the LLM output to extract file blocks.
 * Supports:
 *   --- FILE: GOAL.md ---          (dash separator, preferred)
 *   <!-- FILE: GOAL.md -->         (markdown comment style)
 * Content is everything between one header and the next (or end of string).
 * If content is wrapped in a fenced code block, we strip the fences.
 */
function parseFileBlocks(output) {
  const files = {};

  const headerPattern = /(?:---\s*FILE:\s*([A-Z_]+\.md)\s*---|<!--\s*FILE:\s*([A-Z_]+\.md)\s*-->)/gi;
  const headers = [];
  let match;

  while ((match = headerPattern.exec(output)) !== null) {
    const rawName = (match[1] || match[2]).trim();
    const baseName = rawName.replace(/\.md$/i, '').toUpperCase();
    headers.push({
      name: `${baseName}.md`,
      index: match.index,
      end: match.index + match[0].length,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].end;
    const end = i + 1 < headers.length ? headers[i + 1].index : output.length;
    let content = output.slice(start, end).trim();

    // Strip wrapping code fences if present
    const fenceMatch = content.match(/^```(?:markdown)?\s*\n([\s\S]*?)```\s*$/);
    if (fenceMatch) {
      content = fenceMatch[1].trim();
    }

    if (content) {
      files[headers[i].name] = content + '\n';
    }
  }

  return files;
}

/**
 * Resolve the runner executable and flags from the command template.
 *
 * Given a template like: claude --print "{{handoffPrompt}}"
 * Returns: { args: ['claude', '--print'], usesPromptArg: true }
 *
 * The idea: we strip the {{handoffPrompt}} placeholder and pass the prompt
 * via stdin instead — completely avoiding shell escaping issues.
 */
function parseCommandTemplate(template) {
  // Remove the placeholder and any surrounding quotes
  const cleaned = template
    .replace(/["']?\{\{handoffPrompt\}\}["']?/g, '')
    .trim();

  // Split into args (simple whitespace split, respects basic quoting)
  const args = [];
  let current = '';
  let inQuote = '';

  for (const ch of cleaned) {
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = ch;
    } else if (ch === inQuote) {
      inQuote = '';
    } else if (!inQuote && /\s/.test(ch)) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);

  return { args };
}

function extractQuestions(output) {
  const ansiPattern = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
  const ignoreQuestionPattern = /^(ready to proceed\?|proceed\?|continue\?|should i proceed\?|say\s+[`'"]?(yes|ok|\/execute)[`'"]?.*)$/i;
  const questions = [];
  const seen = new Set();
  const lines = String(output || '').split('\n');

  for (const rawLine of lines) {
    const cleaned = rawLine
      .replace(ansiPattern, '')
      .replace(/^\s*[-*>\d.)]+\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned || cleaned === '?') continue;
    if (cleaned.startsWith('#')) continue;
    if (!cleaned.includes('?')) continue;

    // Keep the concise question text (drop examples after the first '?')
    let normalized = cleaned;
    const qMark = cleaned.indexOf('?');
    if (qMark >= 0) normalized = cleaned.slice(0, qMark + 1).trim();
    normalized = normalized.replace(/^[:\-–—]\s*/, '');

    const alnumCount = normalized.replace(/[^A-Za-z0-9]/g, '').length;
    if (alnumCount < 8) continue;
    if (ignoreQuestionPattern.test(normalized)) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    questions.push(normalized);
    if (questions.length >= 5) break;
  }

  return questions;
}

function inferQuestionsFromClarificationRequest(output) {
  const text = String(output || '');
  if (!/need to gather|need more information|before (creating|generating|proceeding)|ask before generating|awaiting .*input|please provide/i.test(text)) {
    return [];
  }

  const inferred = [];
  if (/project name/i.test(text)) inferred.push('What is the project name?');
  if (/target audience|audience/i.test(text)) inferred.push('Who is the target audience?');
  if (/\btone\b/i.test(text)) inferred.push('What tone should the README use?');

  if (inferred.length === 0) {
    inferred.push('Please provide the clarifications requested by the runner.');
  }
  return inferred;
}

function extractOpenQuestionsFromGoal(goalContent) {
  const sectionMatch = String(goalContent || '').match(/^##\s+Open Questions\s*([\s\S]*?)(?=^##\s+|\s*$)/im);
  if (!sectionMatch) return [];

  const questions = [];
  const seen = new Set();
  const lines = sectionMatch[1].split('\n');

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/^\s*[-*]\s*/, '')
      .replace(/^\s*\d+[.)]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;
    if (/^the following details were requested/i.test(line)) continue;

    // Convert "Label: Assumed ..." into a clear prompt for the user.
    const assumedMatch = line.match(/^\*\*(.+?)\*\*:\s*Assumed\b/i);
    const normalized = assumedMatch
      ? `Please confirm ${assumedMatch[1].replace(/\*+/g, '').trim()}.`
      : line.replace(/\*\*/g, '');

    if (normalized.length < 8) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    questions.push(normalized);
    if (questions.length >= 5) break;
  }

  return questions;
}

function mergeQuestions(...groups) {
  const merged = [];
  const seen = new Set();
  for (const group of groups) {
    for (const raw of group || []) {
      const q = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!q || q === '?' || seen.has(q)) continue;
      seen.add(q);
      merged.push(q);
      if (merged.length >= 5) return merged;
    }
  }
  return merged;
}

/**
 * Run the planning phase using the configured CLI runner and the
 * appropriate Vibe skill (/lite, /full, or /vibe).
 *
 * Strategy: Write the skill prompt to a temp file, then pipe it to the
 * runner via stdin. This completely avoids shell escaping issues with
 * backticks, $variables, quotes, etc.
 *
 * The prompt tells the runner to follow the skill's planning workflow —
 * reading VIBE.md, GUARDS.md, templates — and output build documents
 * using a parseable separator format.
 */
async function runPlanning({ buildId, eventBus }) {
  const meta = await readBuildMeta(buildId);
  if (!meta) {
    throw new Error(`Build ${buildId} not found`);
  }

  if (meta.status && meta.status !== 'pending') {
    throw new Error(`Build ${buildId} is already in ${meta.status} state`);
  }

  const config = await readConfig({ withSecrets: true });
  const exec = config.execution || {};
  const runners = exec.runners || {};
  const preferred = exec.preferredRunner || 'claude';

  // Find an enabled runner
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
    throw new Error('No enabled CLI runner found. Configure a runner (e.g. Claude, Codex) in Settings.');
  }

  // Warn if the preferred runner was skipped (not enabled or missing template)
  if (runnerName !== preferred) {
    const skippedRunner = runners[preferred];
    const reason = !skippedRunner
      ? 'not configured'
      : skippedRunner.enabled !== true
        ? 'not enabled'
        : 'missing command template';
    log('warning', `Preferred runner "${preferred}" is ${reason} — using "${runnerName}" instead.`);
  }

  const buildType = meta.buildType || 'lite';
  const description = meta.description || '';
  const projectRoot = meta.projectRoot || process.cwd();
  const processId = `planning-${buildId}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  let chunkIndex = 0;

  const { skill, label } = skillForBuildType(buildType);

  // Build the skill-based planning prompt
  const planningPrompt = buildSkillPrompt({
    buildId,
    buildType,
    description,
    projectRoot,
  });

  // Write prompt to a temp file
  const uid = crypto.randomBytes(4).toString('hex');
  const tmpDir = os.tmpdir();
  const promptFile = path.join(tmpDir, `vibe-plan-${buildId}-${uid}.txt`);
  await fs.writeFile(promptFile, planningPrompt, 'utf8');

  // Parse the command template to get the executable + flags
  const template = runnerConfig.commandTemplate || '';
  const { args: cmdArgs } = parseCommandTemplate(template);

  if (cmdArgs.length === 0) {
    await fs.unlink(promptFile).catch(() => {});
    throw new Error(`Runner ${runnerName} has an empty command template`);
  }

  // Inject runner-specific model + permission flags via registry
  const modelPrefs = config.modelPreferences?.planning;
  const modelPref = typeof modelPrefs === 'object' ? modelPrefs[runnerName] : (typeof modelPrefs === 'string' ? modelPrefs : null);
  injectRunnerFlags(runnerName, cmdArgs, {
    modelPref,
    permissionMode: exec.permissionMode || 'bypassPermissions',
  });

  // Enable real-time streaming for runners that support it (e.g. Claude)
  const isStreamJson = injectStreamFlags(runnerName, cmdArgs);

  const log = (stream, message) => {
    chunkIndex += 1;
    eventBus.broadcast(buildId, 'execution-log', {
      buildId,
      taskId: null,
      stream,
      message,
      processId,
      processType: 'planning',
      phase: 'planning',
      chunkIndex,
      timestamp: new Date().toISOString(),
    });
  };

  log('system', `Planning ${buildId} with ${runnerName}...`);
  log('system', `Skill: ${skill} (${label})`);
  if (modelPref) log('system', `Model: ${modelPref}`);
  log('system', `Description: ${description}`);
  log('system', '');

  // Spawn: cat <promptFile> | <runner> <flags>
  // This pipes the prompt through stdin, avoiding all shell escaping issues.
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
      buildId,
      type: 'planning',
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
        log('system', '');
        log('system', 'Parsing planning output...');

        // Parse the output into file blocks
        const fileBlocks = parseFileBlocks(fullOutput);
        const dir = buildDirPath(buildId);
        await fs.mkdir(dir, { recursive: true });

        const writtenFiles = [];

        // If the runner returned conversational text with no file blocks,
        // synthesize GOAL.md and TASKS.md from the runner output + description
        const hasNoBlocks = Object.keys(fileBlocks).length === 0;
        if (hasNoBlocks && fullOutput.trim().length > 0) {
          log('warning', 'Runner returned conversational text instead of file blocks.');
          log('system', 'Synthesizing build documents from runner response...');

          // Truncate runner output for the GOAL analysis section
          const snippet = fullOutput.trim().slice(0, 800).replace(/\n{3,}/g, '\n\n');

          fileBlocks['GOAL.md'] = [
            `# Goal`,
            ``,
            `## Intent`,
            `${description}`,
            ``,
            `## Runner Analysis`,
            `${snippet}`,
            ``,
            `## Success Metric`,
            `- Task completed as described`,
            ``,
          ].join('\n') + '\n';

          fileBlocks['TASKS.md'] = [
            `# Build ${buildId} Tasks`,
            ``,
            `Status key: \`pending\`, \`planning\`, \`in_progress\`, \`review\`, \`deployed\`, \`blocked\``,
            ``,
            `## Task List`,
            ``,
            `### T-01: ${description}`,
            `- **Outcome**: ${description}`,
            `- **Risk**: Low`,
            `- **Status**: pending`,
            `- **Acceptance**:`,
            `  - [ ] Implementation matches the description`,
            `  - [ ] Code compiles and tests pass`,
            `- **Files**: (see runner output)`,
            ``,
          ].join('\n') + '\n';
        }

        for (const [fileName, content] of Object.entries(fileBlocks)) {
          const filePath = path.join(dir, fileName);
          await fs.writeFile(filePath, content, 'utf8');
          writtenFiles.push(fileName);
          log('success', `Created ${fileName}`);
        }

        // If the runner didn't produce certain required files, create minimal placeholders
        const requiredFiles = buildType === 'full'
          ? ['GOAL.md', 'TASKS.md', 'PLAN.md', 'RECAP.md']
          : ['GOAL.md', 'TASKS.md', 'RECAP.md'];

        for (const required of requiredFiles) {
          if (!writtenFiles.includes(required)) {
            const filePath = path.join(dir, required);
            try {
              await fs.access(filePath);
            } catch {
              await fs.writeFile(filePath, `# ${required.replace('.md', '')}\n\nTBD - Runner did not generate this file.\n`, 'utf8');
              writtenFiles.push(required);
              log('warning', `${required} was not generated by runner — created placeholder`);
            }
          }
        }

        // Read back the parsed tasks
        let tasks = [];
        try {
          const parsed = await getTasks(buildId);
          tasks = parsed.tasks || [];
        } catch {
          // TASKS.md might be malformed
        }

        if (tasks.length > 0) {
          log('success', `Generated ${tasks.length} task(s):`);
          for (const task of tasks) {
            log('log', `  ${task.id}: ${task.title}`);
          }
        } else {
          log('warning', 'No tasks were parsed from the generated TASKS.md');
        }

        // Detect clarifications the runner still needs.
        const questions = mergeQuestions(
          extractQuestions(fullOutput),
          extractOpenQuestionsFromGoal(fileBlocks['GOAL.md']),
          inferQuestionsFromClarificationRequest(fullOutput)
        );

        if (questions.length > 0) {
          log('system', '');
          log('warning', 'Planning paused: runner needs clarifications before building.');
          for (const q of questions) {
            log('system', `  → ${q}`);
          }

          meta.status = 'planning';
          meta.plannedAt = new Date().toISOString();
          meta.blockedReason = '';
          meta.openQuestions = questions;
          meta.needsInput = {
            phase: 'planning',
            questions,
            updatedAt: new Date().toISOString(),
          };
          await writeBuildMeta(buildId, meta);

          // Emit a dedicated event so the UI can auto-expand the chat with context
          eventBus.broadcast(buildId, 'runner-questions', {
            buildId,
            taskId: null,
            phase: 'planning',
            questions,
            timestamp: new Date().toISOString(),
          });

          resolve({
            buildId,
            buildType,
            status: 'planning',
            description: meta.description,
            tasks,
            docsCreated: writtenFiles,
            questions,
            needsInput: true,
          });
          return;
        }

        // No clarifications needed: planning is complete.
        meta.status = 'planning';
        meta.plannedAt = new Date().toISOString();
        meta.blockedReason = '';
        meta.openQuestions = [];
        meta.needsInput = null;
        await writeBuildMeta(buildId, meta);

        log('success', `Planning complete for ${buildId}. Ready to move to In Progress.`);

        resolve({
          buildId,
          buildType,
          status: 'planning',
          description: meta.description,
          tasks,
          docsCreated: writtenFiles,
        });
      } catch (err) {
        log('error', `Failed to process planning output: ${err.message}`);
        reject(err);
      }
    });
  });
}

module.exports = {
  runPlanning,
  buildSkillPrompt,
  parseFileBlocks,
  parseCommandTemplate,
};
