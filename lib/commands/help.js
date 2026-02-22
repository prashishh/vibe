const chalk = require('chalk');

function help() {
  console.log(chalk.blue.bold('\n🎯 Vibe\n'));

  console.log(chalk.bold('CLI Commands:\n'));

  console.log(chalk.cyan('  vibe init'));
  console.log('    Initialize the framework in your project');
  console.log('    - Creates .vibe/ directory with templates and core files');
  console.log('    - Installs AI assistant skills based on your IDE');
  console.log('    - Creates builds/ directory for build tracking\n');

  console.log(chalk.cyan('  vibe dashboard'));
  console.log('    Start the visual dashboard');
  console.log('    - View all builds, tasks, and progress');
  console.log('    - Read guards and changelog');
  console.log('    - Monitor build metrics\n');

  console.log(chalk.cyan('  vibe help'));
  console.log('    Show this help message\n');

  console.log(chalk.bold('AI Assistant Skills (use in your IDE):\n'));

  console.log(chalk.yellow('  Quick Workflows:'));
  console.log(chalk.dim('    /vibe <fix>     ') + ' - Quick fixes (1-3 tasks, autonomous)');
  console.log(chalk.dim('    /lite <feature> ') + ' - Medium features (3-8 tasks, autonomous)');
  console.log(chalk.dim('    /full <feature> ') + ' - Complex features (8+ tasks, autonomous)\n');

  console.log(chalk.yellow('  Manual Workflows:'));
  console.log(chalk.dim('    /plan <feature> ') + ' - Create build documents');
  console.log(chalk.dim('    /execute        ') + ' - Work on next task');
  console.log(chalk.dim('    /check          ') + ' - Verify all guards pass');
  console.log(chalk.dim('    /review         ') + ' - Review build findings');
  console.log(chalk.dim('    /ship           ') + ' - Deployment checklist');
  console.log(chalk.dim('    /recap          ') + ' - Close build\n');

  console.log(chalk.yellow('  Guards & Discovery:'));
  console.log(chalk.dim('    /guards         ') + ' - Analyze codebase and generate guards');
  console.log(chalk.dim('    /propose        ') + ' - Suggest next build\n');

  console.log(chalk.bold('Project Structure:\n'));
  console.log('  .vibe/');
  console.log('    ├── core/VIBE.md             ' + chalk.dim('Framework specification'));
  console.log('    ├── templates/               ' + chalk.dim('Build templates'));
  console.log('    ├── GUARDS.md                ' + chalk.dim('Safety contracts'));
  console.log('    ├── CHANGELOG.md             ' + chalk.dim('Auto-maintained history'));
  console.log('    └── README.md                ' + chalk.dim('Quick reference'));
  console.log('  builds/');
  console.log('    ├── v1/                      ' + chalk.dim('Build directory'));
  console.log('    ├── v2/');
  console.log('    └── ...');
  console.log('  .claude/skills/                ' + chalk.dim('(or .cursor, .windsurf, etc.)'));
  console.log('  .agent/                        ' + chalk.dim('Universal skills fallback\n'));

  console.log(chalk.bold('Typical Workflow:\n'));
  console.log('  1. ' + chalk.cyan('vibe init') + '                   Initialize framework');
  console.log('  2. ' + chalk.dim('/guards') + '                      Generate safety guards');
  console.log('  3. ' + chalk.dim('/vibe <fix>') + '                  Quick fixes');
  console.log('     ' + chalk.dim('/lite <feature>') + '              Medium features');
  console.log('     ' + chalk.dim('/full <feature>') + '              Complex features');
  console.log('  4. ' + chalk.cyan('vibe dashboard') + '              View progress\n');

  console.log(chalk.bold('Learn More:\n'));
  console.log('  Documentation: ' + chalk.dim('.vibe/README.md'));
  console.log('  Specification: ' + chalk.dim('.vibe/core/VIBE.md'));
  console.log('  Repository:    ' + chalk.dim('https://github.com/prashishrajbhandari/vibe\n'));

  console.log(chalk.green('💡 Tip: All framework files are in .vibe/ - your project root stays clean!\n'));
}

module.exports = help;
