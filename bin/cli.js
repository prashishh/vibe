#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const init = require('../lib/commands/init');
const plan = require('../lib/commands/plan');
const dashboard = require('../lib/commands/dashboard');
const help = require('../lib/commands/help');

program
  .name('vibe')
  .description('Agentic software delivery framework')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize Vibe Framework in current project')
  .action(async () => {
    try {
      await init();
    } catch (error) {
      console.error(chalk.red('Error during initialization:'), error.message);
      process.exit(1);
    }
  });

program
  .command('plan [feature]')
  .description('Plan a new build')
  .action(async (feature) => {
    try {
      await plan(feature);
    } catch (error) {
      console.error(chalk.red('Error during planning:'), error.message);
      process.exit(1);
    }
  });

program
  .command('dashboard')
  .description('Start the dashboard for this project')
  .action(async () => {
    try {
      await dashboard();
    } catch (error) {
      console.error(chalk.red('Error starting dashboard:'), error.message);
      process.exit(1);
    }
  });

program
  .command('help')
  .description('Show detailed help and usage information')
  .action(() => {
    help();
  });

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  help();
  process.exit(0);
}

program.parse(process.argv);
