const chalk = require('chalk');

async function plan(feature) {
  if (!feature) {
    console.log(chalk.red('❌ Please provide a feature description'));
    console.log(chalk.dim('Usage: vibe plan "Add user profiles"'));
    return;
  }

  console.log(chalk.blue('📋 Planning new build...'));
  console.log(chalk.dim('\nNote: For full planning functionality, use Claude Code with /plan command'));
  console.log(chalk.dim('This CLI command is a placeholder for future implementation.\n'));

  console.log(`Feature: ${chalk.green(feature)}`);
  console.log('\n' + chalk.yellow('💡 Try using Claude Code instead:'));
  console.log(chalk.dim('   /plan ' + feature));
}

module.exports = plan;
