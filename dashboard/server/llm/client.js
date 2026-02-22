'use strict';

// Utility functions for building task objects from user prompts.
// These are pure helpers — no API calls, no external dependencies.

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
  buildTaskFromPrompt,
};
