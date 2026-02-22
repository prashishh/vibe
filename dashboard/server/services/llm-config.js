const fs = require('fs/promises');
const path = require('path');

const DEFAULT_CONFIG = {
  version: '1.4',
  execution: {
    mode: 'auto_run',
    preferredRunner: 'claude',
    permissionMode: 'bypassPermissions',
    runners: {
      claude: {
        enabled: true,
        commandTemplate: 'claude --print "{{handoffPrompt}}"'
      },
      codex: {
        enabled: false,
        commandTemplate: 'codex exec - "{{handoffPrompt}}"'
      },
      gemini: {
        enabled: false,
        commandTemplate: 'gemini -p "{{handoffPrompt}}"'
      }
    }
  },
  modelPreferences: {
    planning:  { claude: 'claude-opus-4-6',            codex: 'gpt-5.2',            gemini: 'gemini-2.5-pro' },
    execution: { claude: 'claude-sonnet-4-5-20250929', codex: 'gpt-5.1-codex-mini', gemini: 'gemini-2.5-flash' },
    feedback:  { claude: 'claude-sonnet-4-5-20250929', codex: 'gpt-5.2',            gemini: 'gemini-2.5-pro' },
    guards:    { claude: 'claude-haiku-4-5-20251001',  codex: 'gpt-5.1-codex-mini', gemini: 'gemini-2.5-flash' },
  },
};

function resolveConfigPath() {
  if (process.env.VIBE_LLM_CONFIG_PATH) {
    return path.resolve(process.env.VIBE_LLM_CONFIG_PATH);
  }
  return path.resolve(process.cwd(), '.vibe/llm-config.json');
}

/**
 * Migrates older config versions to the current format.
 * - Adds gemini runner if missing
 * - Fixes the old codex template
 * - Converts flat modelPreferences strings to per-runner objects
 * - Strips legacy llms/providers sections (API key infrastructure)
 */
function migrateConfig(config) {
  const c = JSON.parse(JSON.stringify(config));

  // Add gemini runner if missing
  if (c.execution?.runners && !c.execution.runners.gemini) {
    c.execution.runners.gemini = { enabled: false, commandTemplate: 'gemini -p "{{handoffPrompt}}"' };
  }

  // Fix old gemini template (was missing `-p` for headless mode)
  if (c.execution?.runners?.gemini?.commandTemplate === 'gemini "{{handoffPrompt}}"') {
    c.execution.runners.gemini.commandTemplate = 'gemini -p "{{handoffPrompt}}"';
  }

  // Fix old codex template (was missing `exec -`)
  if (c.execution?.runners?.codex?.commandTemplate === 'codex "{{handoffPrompt}}"') {
    c.execution.runners.codex.commandTemplate = 'codex exec - "{{handoffPrompt}}"';
  }

  // Upgrade flat modelPreferences to per-runner structure
  if (c.modelPreferences) {
    for (const phase of ['planning', 'execution', 'feedback', 'guards']) {
      const val = c.modelPreferences[phase];
      if (typeof val === 'string') {
        c.modelPreferences[phase] = {
          claude: val,  // preserve existing value for claude
          codex: DEFAULT_CONFIG.modelPreferences[phase]?.codex || '',
          gemini: DEFAULT_CONFIG.modelPreferences[phase]?.gemini || '',
        };
      }
    }
    // Ensure execution key exists (old configs may not have it)
    if (!c.modelPreferences.execution) {
      c.modelPreferences.execution = { ...DEFAULT_CONFIG.modelPreferences.execution };
    }
    // Remove legacy triage model preferences
    delete c.modelPreferences.triage;
  }

  // Migrate old codex model IDs to GPT-5.x names
  const CODEX_MODEL_MAP = { 'o3': 'gpt-5.2', 'o4-mini': 'gpt-5.1-codex-mini', 'codex-mini': 'gpt-5.1-codex-mini' };
  if (c.modelPreferences) {
    for (const phase of ['planning', 'execution', 'feedback', 'guards']) {
      const codexModel = c.modelPreferences[phase]?.codex;
      if (codexModel && CODEX_MODEL_MAP[codexModel]) {
        c.modelPreferences[phase].codex = CODEX_MODEL_MAP[codexModel];
      }
    }
  }

  // Strip legacy API key infrastructure
  delete c.llms;
  delete c.providers;

  c.version = '1.4';
  return c;
}

async function ensureConfigExists() {
  const configPath = resolveConfigPath();
  try {
    await fs.access(configPath);
  } catch {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
  }
  return configPath;
}

async function readConfig() {
  const configPath = await ensureConfigExists();
  const raw = await fs.readFile(configPath, 'utf8');
  let parsed = JSON.parse(raw);

  // Auto-migrate older config versions
  if (!parsed.version || parsed.version < '1.4') {
    parsed = migrateConfig(parsed);
    await fs.writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  }

  return parsed;
}

async function writeConfig(nextConfig) {
  const configPath = await ensureConfigExists();
  const merged = JSON.parse(JSON.stringify(nextConfig));

  // Strip any legacy fields that might have been sent from older clients
  delete merged.llms;
  delete merged.providers;

  await fs.writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return readConfig();
}

module.exports = {
  DEFAULT_CONFIG,
  resolveConfigPath,
  readConfig,
  writeConfig,
};
