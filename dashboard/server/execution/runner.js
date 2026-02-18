const { readConfig } = require('../services/llm-config');
const { injectRunnerFlags } = require('./runner-registry');
const { injectStreamFlags } = require('./stream-parser');
const { spawnSync } = require('child_process');

function interpolate(template, vars) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

/**
 * Parse a command template to extract the executable + flags,
 * stripping the {{handoffPrompt}} placeholder (prompt is piped via stdin instead).
 */
function parseCommandTemplate(template) {
  const cleaned = String(template || '')
    .replace(/["']?\{\{handoffPrompt\}\}["']?/g, '')
    .trim();

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

function buildHandoffPrompt({ buildId, task }) {
  const acceptance = (task.acceptance || []).map(item => `- ${item}`).join('\n');
  const files = (task.files || []).join(', ');

  const lines = [
    `Execute Vibe task ${task.id} from build ${buildId}.`,
    `Title: ${task.title}`,
    `Outcome: ${task.outcome || 'N/A'}`,
    `Risk: ${task.risk || 'Medium'}`,
    '',
    'Acceptance criteria:',
    acceptance || '- Follow task acceptance in TASKS.md/PLAN.md',
  ];

  if (files) {
    lines.push('', `Expected files: ${files}`);
  }

  lines.push('', 'Workflow:', '1. Implement the task', '2. Update tests/guards', '3. Mark task status in TASKS.md');

  return lines.join('\n');
}

async function resolveRunnerCommand({ buildId, task }) {
  const config = await readConfig({ withSecrets: true });
  const exec = config.execution || {};
  const mode = exec.mode || 'auto_run';
  const runners = exec.runners || {};

  const handoffPrompt = buildHandoffPrompt({ buildId, task });

  if (mode !== 'auto_run') {
    return {
      mode: 'manual',
      handoffPrompt,
      reason: `Execution mode is ${mode}`,
    };
  }

  const preferred = exec.preferredRunner || 'claude';
  const ordered = [
    preferred,
    ...Object.keys(runners).filter(name => name !== preferred),
  ];

  for (const name of ordered) {
    const runner = runners[name];
    if (!runner || runner.enabled !== true) continue;
    if (!runner.commandTemplate || !String(runner.commandTemplate).trim()) continue;

    // Parse the template to get the executable + flags (prompt stripped out)
    const { args: cmdArgs } = parseCommandTemplate(runner.commandTemplate);
    if (cmdArgs.length === 0) continue;

    // Resolve per-runner model preference for execution phase
    const modelPrefs = config.modelPreferences?.execution;
    const modelPref = typeof modelPrefs === 'object' ? modelPrefs[name] : (typeof modelPrefs === 'string' ? modelPrefs : null);

    // Inject runner-specific flags (permissions + model) via registry
    injectRunnerFlags(name, cmdArgs, {
      modelPref,
      permissionMode: exec.permissionMode || 'bypassPermissions',
    });

    // Enable real-time streaming for runners that support it (e.g. Claude)
    const isStreamJson = injectStreamFlags(name, cmdArgs);

    // Build the shell command that pipes the prompt via stdin
    // This avoids all shell escaping issues with backticks, $, quotes, etc.
    const shellCmd = cmdArgs.map(a => JSON.stringify(a)).join(' ');

    return {
      mode: 'auto_run',
      runner: name,
      command: shellCmd,
      handoffPrompt,
      cmdArgs,
      isStreamJson,
    };
  }

  return {
    mode: 'manual',
    handoffPrompt,
    reason: 'No enabled runner command template found',
  };
}

function extractExecutable(command) {
  const text = String(command || '').trim();
  if (!text) return '';
  const first = text.match(/^[^\s]+/);
  return first ? first[0].replace(/^['"]|['"]$/g, '') : '';
}

function commandExists(executable) {
  if (!executable) return false;
  if (!/^[a-zA-Z0-9._/-]+$/.test(executable)) {
    return false;
  }

  const probe = spawnSync('sh', ['-lc', `command -v ${executable}`], {
    stdio: 'ignore',
  });
  return probe.status === 0;
}

async function probeRunner(runnerName) {
  const config = await readConfig({ withSecrets: true });
  const runner = config.execution?.runners?.[runnerName];

  if (!runner) {
    return {
      ok: false,
      runner: runnerName,
      message: `Runner not configured: ${runnerName}`,
    };
  }

  if (runner.enabled !== true) {
    return {
      ok: false,
      runner: runnerName,
      message: `Runner is disabled: ${runnerName}`,
    };
  }

  const sampleTask = {
    id: 'T-00',
    title: 'Runner probe',
    outcome: 'Validate runner command',
    risk: 'Low',
    acceptance: ['Command template resolves and executable is on PATH'],
    files: [],
  };

  const handoffPrompt = buildHandoffPrompt({ buildId: 'v0', task: sampleTask });
  const shellSafePrompt = handoffPrompt
    .replace(/\s+/g, ' ')
    .replace(/"/g, '\\"')
    .trim();

  const resolvedCommand = interpolate(runner.commandTemplate, {
    buildId: 'v0',
    taskId: sampleTask.id,
    taskTitle: sampleTask.title,
    handoffPrompt: shellSafePrompt,
  }).trim();

  const executable = extractExecutable(resolvedCommand);
  const exists = commandExists(executable);

  if (!exists) {
    return {
      ok: false,
      runner: runnerName,
      command: resolvedCommand,
      executable,
      message: `Executable not found on PATH: ${executable || '(empty)'}`,
    };
  }

  return {
    ok: true,
    runner: runnerName,
    command: resolvedCommand,
    executable,
    message: `Runner executable found: ${executable}`,
  };
}

module.exports = {
  resolveRunnerCommand,
  buildHandoffPrompt,
  probeRunner,
};
