'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Runner Capabilities Registry
//
// Data-driven registry of CLI runner capabilities. Replaces scattered
// `if (name === 'claude')` conditionals with a single lookup table.
// ─────────────────────────────────────────────────────────────────────────────

const RUNNER_CAPABILITIES = {
  claude: {
    displayName: 'Claude Code',
    modelFlag: '--model',
    permissionFlags: {
      bypassPermissions: ['--dangerously-skip-permissions'],
      acceptEdits: ['--permission-mode', 'acceptEdits'],
    },
    defaultTemplate: 'claude --print "{{handoffPrompt}}"',
    defaultModels: {
      planning: 'claude-opus-4-6',
      execution: 'claude-sonnet-4-5-20250929',
      feedback: 'claude-sonnet-4-5-20250929',
      guards: 'claude-haiku-4-5-20251001',
    },
    commonModels: ['claude-opus-4-6', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  },
  codex: {
    displayName: 'OpenAI Codex',
    modelFlag: '--model',
    permissionFlags: {
      bypassPermissions: ['--full-auto'],
    },
    defaultTemplate: 'codex exec - "{{handoffPrompt}}"',
    defaultModels: {
      planning: 'o3',
      execution: 'codex-mini',
      feedback: 'o3',
      guards: 'o4-mini',
    },
    commonModels: ['o3', 'o4-mini', 'codex-mini'],
  },
  gemini: {
    displayName: 'Google Gemini',
    modelFlag: '-m',
    permissionFlags: {},              // Gemini has no permission bypass flag
    defaultTemplate: 'gemini "{{handoffPrompt}}"',
    defaultModels: {
      planning: 'gemini-2.5-pro',
      execution: 'gemini-2.5-flash',
      feedback: 'gemini-2.5-pro',
      guards: 'gemini-2.5-flash',
    },
    commonModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  },
};

/**
 * Look up capabilities for a runner by name.
 * Returns the capabilities object or null if unknown.
 */
function getRunnerCapabilities(name) {
  return RUNNER_CAPABILITIES[name] || null;
}

/**
 * Returns the list of known runner names.
 */
function getKnownRunners() {
  return Object.keys(RUNNER_CAPABILITIES);
}

/**
 * Injects runner-specific flags into the command arguments array (mutates in place).
 *
 * @param {string}   runnerName       - e.g. 'claude', 'codex', 'gemini'
 * @param {string[]} cmdArgs          - mutable array of command arguments
 * @param {object}   opts
 * @param {string}   [opts.modelPref] - model string to inject via the runner's model flag
 * @param {string}   [opts.permissionMode] - e.g. 'bypassPermissions', 'acceptEdits', 'default'
 */
function injectRunnerFlags(runnerName, cmdArgs, opts = {}) {
  const caps = RUNNER_CAPABILITIES[runnerName];
  if (!caps) return; // unknown runner — leave cmdArgs untouched

  const { modelPref, permissionMode } = opts;

  // ── Permission flags ──
  if (permissionMode && permissionMode !== 'default') {
    const permFlags = caps.permissionFlags?.[permissionMode];
    if (permFlags && permFlags.length > 0) {
      // Only add if not already present (avoid duplicates)
      const alreadyHas = permFlags.some(f => cmdArgs.includes(f));
      if (!alreadyHas) {
        cmdArgs.push(...permFlags);
      }
    }
  }

  // ── Model flag ──
  if (modelPref && caps.modelFlag) {
    cmdArgs.push(caps.modelFlag, modelPref);
  }
}

module.exports = {
  RUNNER_CAPABILITIES,
  getRunnerCapabilities,
  getKnownRunners,
  injectRunnerFlags,
};
