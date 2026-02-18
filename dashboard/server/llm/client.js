class LLMClient {
  constructor(config = {}) {
    this.provider = config.provider || 'mock';
    this.model = config.model || 'mock-model';
    this.apiKey = config.apiKey || '';
    this.temperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async chat(messages) {
    const last = messages[messages.length - 1]?.content || '';
    return this.mockResponse(String(last));
  }

  mockResponse(text) {
    return `Mock response for: ${text.slice(0, 120)}`;
  }

  async testConnection() {
    const hasKey = Boolean(this.apiKey && !String(this.apiKey).startsWith('${'));
    return {
      ok: hasKey,
      provider: this.provider,
      model: this.model,
      message: hasKey
        ? 'Configuration looks valid. Network check is skipped in local validation mode.'
        : 'API key is missing or unresolved.',
    };
  }
}

function dedupe(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function guessRisk(prompt) {
  const lower = prompt.toLowerCase();
  if (/(security|auth|payment|migration|critical|delete|compliance)/.test(lower)) {
    return 'High';
  }
  if (/(refactor|infra|database|api)/.test(lower)) {
    return 'Medium';
  }
  return 'Low';
}

function extractFiles(prompt) {
  const fileMatches = prompt.match(/[A-Za-z0-9_./-]+\.[a-zA-Z0-9]+/g) || [];
  return dedupe(fileMatches);
}

function extractAcceptance(prompt) {
  const checks = [];
  checks.push('Implementation completed with clear code changes');
  checks.push('Relevant tests added or updated');
  checks.push('No guardrail regressions introduced');

  if (/rate limit/i.test(prompt)) {
    checks.unshift('429 returned after configured threshold is exceeded');
  }

  return dedupe(checks);
}

function normalizeTitle(prompt) {
  const cleaned = prompt.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'New task';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildTaskFromPrompt(prompt) {
  const title = normalizeTitle(prompt);
  const files = extractFiles(prompt);
  const risk = guessRisk(prompt);

  return {
    title,
    outcome: `Deliver: ${title}`,
    risk,
    status: 'pending',
    acceptance: extractAcceptance(prompt),
    files,
    guardrails: [],
  };
}

module.exports = {
  LLMClient,
  buildTaskFromPrompt,
};
