const path = require('path');
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

  let selectedRunner = null;
  let selectedResult = null;

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

    selectedRunner = name;
    selectedResult = {
      mode: 'auto_run',
      runner: name,
      command: shellCmd,
      handoffPrompt,
      cmdArgs,
      isStreamJson,
    };
    break;
  }

  if (selectedResult) {
    // Warn if the preferred runner was skipped
    if (selectedRunner !== preferred) {
      const skippedRunner = runners[preferred];
      const reason = !skippedRunner
        ? 'not configured'
        : skippedRunner.enabled !== true
          ? 'not enabled'
          : 'missing command template';
      console.warn(`Preferred runner "${preferred}" is ${reason} — using "${selectedRunner}" instead.`);
    }
    return selectedResult;
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

/**
 * Resolve a PATH prefix for a runner executable.
 *
 * Fixes nvm PATH ordering issues: when a runner (e.g. codex) is installed
 * under nvm Node v22 but `sh -l` resolves `node` to a system Node v20,
 * the runner's `#!/usr/bin/env node` picks the wrong interpreter.
 *
 * Returns a shell snippet (e.g. `export PATH="/nvm/.../bin:$PATH" && `)
 * that should be prepended to the shell command. This runs *after* the login
 * shell profile loads, so it correctly overrides the profile's PATH.
 * Returns an empty string if no fix is needed.
 */
function resolveRunnerPathPrefix(executable) {
  if (!executable) return '';

  // Resolve the real path of the executable via `sh -lc`
  const probe = spawnSync('sh', ['-lc', `command -v ${executable}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const resolvedPath = (probe.stdout || '').trim();
  if (!resolvedPath) return '';

  // If the binary lives outside system dirs (e.g. in an nvm directory),
  // return an export that prepends its bin dir to PATH.
  const binDir = path.dirname(resolvedPath);
  if (binDir && binDir !== '/usr/local/bin' && binDir !== '/usr/bin') {
    return `export PATH=${JSON.stringify(binDir)}:"$PATH" && `;
  }

  return '';
}

module.exports = {
  resolveRunnerCommand,
  resolveRunnerPathPrefix,
  buildHandoffPrompt,
  probeRunner,
};
