const fs = require('fs/promises');
const path = require('path');

const DEFAULT_CONFIG = {
  version: '1.1',
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
        commandTemplate: 'gemini "{{handoffPrompt}}"'
      }
    }
  },
  llms: {
    planning: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      apiKey: '${ANTHROPIC_API_KEY}',
      temperature: 0.7,
      maxTokens: 4096,
      timeoutMs: 180000,
    },
    execution: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      apiKey: '${ANTHROPIC_API_KEY}',
      temperature: 0.3,
      maxTokens: 8192,
      timeoutMs: 1800000,
    },
    testing: {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: '${OPENAI_API_KEY}',
      temperature: 0.2,
      maxTokens: 4096,
      timeoutMs: 180000,
    },
    guards: {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: '${OPENAI_API_KEY}',
      temperature: 0.1,
      maxTokens: 4096,
      timeoutMs: 180000,
    },
    review: {
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      apiKey: '${ANTHROPIC_API_KEY}',
      temperature: 0.1,
      maxTokens: 8192,
      timeoutMs: 180000,
    },
  },
  modelPreferences: {
    planning:  { claude: 'claude-opus-4-6',            codex: 'o3',         gemini: 'gemini-2.5-pro' },
    execution: { claude: 'claude-sonnet-4-5-20250929', codex: 'codex-mini', gemini: 'gemini-2.5-flash' },
    feedback:  { claude: 'claude-sonnet-4-5-20250929', codex: 'o3',         gemini: 'gemini-2.5-pro' },
    guards:    { claude: 'claude-haiku-4-5-20251001',  codex: 'o4-mini',    gemini: 'gemini-2.5-flash' },
  },
  providers: {
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1',
      headers: {},
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      headers: {},
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      headers: {},
    },
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      headers: {},
    },
  },
};

function resolveConfigPath() {
  if (process.env.VIBE_LLM_CONFIG_PATH) {
    return path.resolve(process.env.VIBE_LLM_CONFIG_PATH);
  }
  return path.resolve(process.cwd(), '.vibe/llm-config.json');
}

function resolveEnvRef(value) {
  if (typeof value !== 'string') return value;
  const match = value.match(/^\$\{([A-Z0-9_]+)\}$/);
  if (!match) return value;
  return process.env[match[1]] || '';
}

function expandConfigEnv(config) {
  const cloned = JSON.parse(JSON.stringify(config));
  for (const profileName of Object.keys(cloned.llms || {})) {
    const profile = cloned.llms[profileName];
    if (profile && profile.apiKey) {
      profile.apiKey = resolveEnvRef(profile.apiKey);
    }
  }
  return cloned;
}

/**
 * Migrates older config versions to the current format.
 * - Adds gemini runner if missing
 * - Fixes the old codex template
 * - Converts flat modelPreferences strings to per-runner objects
 */
function migrateConfig(config) {
  const c = JSON.parse(JSON.stringify(config));

  // Add gemini runner if missing
  if (c.execution?.runners && !c.execution.runners.gemini) {
    c.execution.runners.gemini = { enabled: false, commandTemplate: 'gemini "{{handoffPrompt}}"' };
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
  }

  c.version = '1.1';
  return c;
}

function obfuscateKey(value) {
  if (!value) return '';
  const key = String(value);
  if (key.length <= 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function sanitizeForResponse(config) {
  const cloned = JSON.parse(JSON.stringify(config));
  for (const profileName of Object.keys(cloned.llms || {})) {
    const profile = cloned.llms[profileName];
    const rawApiKey = String(profile.apiKey || '');
    profile.apiKeyPreview = obfuscateKey(resolveEnvRef(rawApiKey));
    profile.apiKey = /^\$\{[A-Z0-9_]+\}$/.test(rawApiKey) ? rawApiKey : '';
  }
  return cloned;
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

async function readConfig({ withSecrets = false } = {}) {
  const configPath = await ensureConfigExists();
  const raw = await fs.readFile(configPath, 'utf8');
  let parsed = JSON.parse(raw);

  // Auto-migrate older config versions
  if (!parsed.version || parsed.version < '1.1') {
    parsed = migrateConfig(parsed);
    await fs.writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  }

  if (withSecrets) {
    return expandConfigEnv(parsed);
  }
  return sanitizeForResponse(parsed);
}

async function writeConfig(nextConfig) {
  const configPath = await ensureConfigExists();
  const existingRaw = await fs.readFile(configPath, 'utf8');
  const existing = JSON.parse(existingRaw);
  const merged = JSON.parse(JSON.stringify(nextConfig));

  for (const profileName of Object.keys(merged.llms || {})) {
    const incoming = merged.llms[profileName];
    const hasApiKey = Boolean(String(incoming.apiKey || '').trim());
    if (!hasApiKey && existing.llms?.[profileName]?.apiKey) {
      incoming.apiKey = existing.llms[profileName].apiKey;
    }
  }

  await fs.writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return readConfig({ withSecrets: false });
}

module.exports = {
  DEFAULT_CONFIG,
  resolveConfigPath,
  readConfig,
  writeConfig,
};
