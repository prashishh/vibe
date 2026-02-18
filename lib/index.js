// Main exports for programmatic use
const init = require('./commands/init');
const plan = require('./commands/plan');
const dashboard = require('./commands/dashboard');
const { generateGuards } = require('./generators/guards');
const { copyTemplates, configureDashboard } = require('./utils/files');

module.exports = {
  // Commands
  init,
  plan,
  dashboard,

  // Generators
  generateGuards,

  // Utilities
  copyTemplates,
  configureDashboard
};
