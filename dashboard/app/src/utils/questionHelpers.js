/**
 * Shared utilities for normalizing and collecting agent questions.
 * Used by AgentPanel and BuildDetailPanel.
 */

export function normalizeQuestion(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/^\s*[-*>\d.)]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function collectQuestions(pendingQuestions = []) {
  const deduped = []
  const seen = new Set()
  for (const group of pendingQuestions) {
    const list = Array.isArray(group?.questions) ? group.questions : []
    for (const raw of list) {
      const q = normalizeQuestion(raw)
      if (!q || q === '?' || seen.has(q)) continue
      seen.add(q)
      deduped.push(q)
    }
  }
  return deduped
}
