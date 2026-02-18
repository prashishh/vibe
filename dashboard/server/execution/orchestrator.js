function buildExecutionPrompt(task, guardContracts = []) {
  const acceptance = (task.acceptance || []).map(item => `- ${item}`).join('\n') || '- Define acceptance criteria';
  const guards = guardContracts.length
    ? guardContracts.map(guard => `- ${guard.id}: ${guard.contract || ''}`).join('\n')
    : '- No explicit guard contracts provided';

  return [
    `TASK: ${task.id} - ${task.title}`,
    `RISK: ${task.risk}`,
    `OUTCOME: ${task.outcome || 'N/A'}`,
    'ACCEPTANCE:',
    acceptance,
    'GUARDS:',
    guards,
  ].join('\n');
}

module.exports = {
  buildExecutionPrompt,
};
