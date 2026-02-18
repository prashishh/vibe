const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const {
  copyTemplates,
  configureDashboard,
  createDefaultLLMConfig,
  createQuickReference,
  copySkills,
  createProjectMemory
} = require('../utils/files');

async function init() {
  console.log('');
  console.log(chalk.blue.bold('  ██╗   ██╗██╗██████╗ ███████╗'));
  console.log(chalk.blue.bold('  ██║   ██║██║██╔══██╗██╔════╝'));
  console.log(chalk.blue.bold('  ██║   ██║██║██████╔╝█████╗  '));
  console.log(chalk.blue.bold('  ╚██╗ ██╔╝██║██╔══██╗██╔══╝  '));
  console.log(chalk.blue.bold('   ╚████╔╝ ██║██████╔╝███████╗'));
  console.log(chalk.blue.bold('    ╚═══╝  ╚═╝╚═════╝ ╚══════╝'));
  console.log('');
  console.log(chalk.blue.bold('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║              🎯 Installation Wizard v0.1.0                    ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  const cwd = process.cwd();
  const projectName = path.basename(cwd);

  // Pre-flight checks
  console.log(chalk.cyan('─── System Check ───────────────────────────────────────────────\n'));

  const checks = [];

  // Check Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
  const nodeMinor = parseInt(nodeVersion.slice(1).split('.')[1]);
  const nodeCompatible = (nodeMajor === 20 && nodeMinor >= 19) || nodeMajor >= 22;

  if (nodeCompatible) {
    checks.push({ status: 'success', message: `Node.js ${nodeVersion}`, detail: 'compatible' });
  } else {
    checks.push({ status: 'warning', message: `Node.js ${nodeVersion}`, detail: 'requires 20.19+ or 22.12+' });
  }

  // Check Git repository
  const isGitRepo = fs.existsSync(path.join(cwd, '.git'));
  if (isGitRepo) {
    checks.push({ status: 'success', message: 'Git repository', detail: 'detected' });
  } else {
    checks.push({ status: 'info', message: 'Git repository', detail: 'not found (optional)' });
  }

  // Check write permissions
  try {
    const testFile = path.join(cwd, '.vibe-test-' + Date.now());
    await fs.writeFile(testFile, 'test');
    await fs.remove(testFile);
    checks.push({ status: 'success', message: 'Write permissions', detail: 'OK' });
  } catch (err) {
    checks.push({ status: 'error', message: 'Write permissions', detail: 'denied' });
  }

  // Display checks
  for (const check of checks) {
    const icon = check.status === 'success' ? chalk.green('✓') :
                 check.status === 'warning' ? chalk.yellow('⚠') :
                 check.status === 'error' ? chalk.red('✗') :
                 chalk.blue('ℹ');

    const color = check.status === 'success' ? chalk.white :
                  check.status === 'warning' ? chalk.yellow :
                  check.status === 'error' ? chalk.red :
                  chalk.dim;

    console.log(`  ${icon} ${color(check.message)} ${chalk.dim('(' + check.detail + ')')}`);
  }

  console.log('');

  // Check for critical errors
  const hasErrors = checks.some(c => c.status === 'error');
  if (hasErrors) {
    console.log(chalk.red('❌ Cannot proceed due to errors above.\n'));
    process.exit(1);
  }

  // Warn about Node.js version but allow continuation
  if (!nodeCompatible) {
    console.log(chalk.yellow('⚠️  Node.js version may cause issues. Recommended: 20.19+ or 22.12+'));
    const { continueAnyway } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueAnyway',
      message: 'Continue anyway?',
      default: false
    }]);
    if (!continueAnyway) {
      console.log(chalk.yellow('\nInstallation cancelled.\n'));
      return;
    }
    console.log('');
  }

  // Check if already initialized
  if (fs.existsSync(path.join(cwd, '.vibe'))) {
    console.log(chalk.yellow('⚠️  Framework already initialized in this directory.\n'));
    const { continueInit } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueInit',
      message: 'Continue anyway?',
      default: false
    }]);
    if (!continueInit) {
      console.log(chalk.yellow('Installation cancelled.\n'));
      return;
    }
    console.log('');
  }

  // Welcome message
  console.log(chalk.dim(`Installing Vibe Framework in: ${chalk.white(projectName)}\n`));

  // Ask which IDE they're using
  console.log(chalk.cyan('─── Which AI coding assistant are you using? ───────────────────\n'));

  const { ide } = await inquirer.prompt([{
    type: 'list',
    name: 'ide',
    message: 'Select your primary AI assistant:',
    choices: [
      { name: '  Claude Code' + chalk.dim(' (.claude/skills/)'), value: 'claude' },
      { name: '  Codex' + chalk.dim(' (.agents/skills/)'), value: 'codex' },
      { name: '  Cursor' + chalk.dim(' (.cursor/skills/)'), value: 'cursor' },
      { name: '  Windsurf' + chalk.dim(' (.windsurf/skills/)'), value: 'windsurf' },
      { name: '  GitHub Copilot' + chalk.dim(' (.github/skills/)'), value: 'copilot' },
      { name: '  Aider' + chalk.dim(' (.aider/skills/)'), value: 'aider' },
      { name: '  Cline' + chalk.dim(' (.cline/skills/)'), value: 'cline' },
      { name: '  Cody' + chalk.dim(' (.agents/skills/)'), value: 'cody' },
      { name: '  Continue.dev' + chalk.dim(' (.continue/skills/)'), value: 'continue' },
      { name: '  Devin' + chalk.dim(' (.devin/skills/)'), value: 'devin' },
      { name: '  Replit Agent' + chalk.dim(' (.replit/skills/)'), value: 'replit' },
      { name: '  Roo Code' + chalk.dim(' (.roo/skills/)'), value: 'roo' },
      { name: '  Tabnine' + chalk.dim(' (.agents/skills/)'), value: 'tabnine' },
      { name: '  Zed AI' + chalk.dim(' (.agents/skills/)'), value: 'zed' },
      new inquirer.Separator(chalk.dim('───────────────────────────────────────────────────')),
      { name: '  Other / Multiple' + chalk.dim(' (.agents/skills/)'), value: 'other' }
    ],
    default: 'claude',
    pageSize: 16
  }]);

  // Ask for installation method
  console.log('\n' + chalk.cyan('─── Installation method ────────────────────────────────────────\n'));

  const { installMethod } = await inquirer.prompt([{
    type: 'list',
    name: 'installMethod',
    message: 'How should skills be installed?',
    choices: [
      {
        name: '  Symlink (Recommended)' + chalk.dim(' (Single source of truth, easy updates)'),
        value: 'symlink'
      },
      {
        name: '  Copy to all agents' + chalk.dim(' (Independent copies, no updates)'),
        value: 'copy'
      }
    ],
    default: 'symlink'
  }]);

  // Ask for installation scope
  console.log('\n' + chalk.cyan('─── Installation scope ─────────────────────────────────────────\n'));

  const { installScope } = await inquirer.prompt([{
    type: 'list',
    name: 'installScope',
    message: 'Where should the framework be installed?',
    choices: [
      {
        name: '  Project' + chalk.dim(' (This project only)'),
        value: 'project'
      },
      {
        name: '  Global' + chalk.dim(' (Install in home directory, available across all projects)'),
        value: 'global'
      }
    ],
    default: 'project'
  }]);

  // Git integration (only if Git repo exists)
  let configureGit = false;
  if (isGitRepo) {
    console.log('\n' + chalk.cyan('─── Git Integration ────────────────────────────────────────────\n'));

    const { gitSetup } = await inquirer.prompt([{
      type: 'confirm',
      name: 'gitSetup',
      message: 'Add .vibe/builds/ to .gitignore?',
      default: true
    }]);

    configureGit = gitSetup;
  }

  // Installation summary
  const ideNames = {
    claude: 'Claude Code',
    codex: 'Codex',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    copilot: 'GitHub Copilot',
    aider: 'Aider',
    cline: 'Cline',
    cody: 'Cody',
    continue: 'Continue.dev',
    devin: 'Devin',
    replit: 'Replit Agent',
    roo: 'Roo Code',
    tabnine: 'Tabnine',
    zed: 'Zed AI',
    other: 'Other / Multiple'
  };

  const ideDirs = {
    claude: '.claude/skills',
    codex: '.agents/skills',
    cursor: '.cursor/skills',
    windsurf: '.windsurf/skills',
    copilot: '.github/skills',
    aider: '.aider/skills',
    cline: '.cline/skills',
    cody: '.agents/skills',
    continue: '.continue/skills',
    devin: '.devin/skills',
    replit: '.replit/skills',
    roo: '.roo/skills',
    tabnine: '.agents/skills',
    zed: '.agents/skills',
    other: null
  };

  const installLocation = installScope === 'global'
    ? path.join(require('os').homedir(), '.vibe-framework')
    : cwd;

  console.log('\n' + chalk.cyan('─── Installation Summary ───────────────────────────────────────\n'));
  console.log(chalk.dim('  Project:') + chalk.white(` ${projectName}`));
  console.log(chalk.dim('  Location:') + chalk.white(` ${installLocation}`));
  console.log(chalk.dim('  AI Assistant:') + chalk.white(` ${ideNames[ide]}`));
  console.log(chalk.dim('  Install Method:') + chalk.white(` ${installMethod === 'symlink' ? 'Symlink' : 'Copy'}`));
  console.log(chalk.dim('  Scope:') + chalk.white(` ${installScope === 'global' ? 'Global' : 'Project'}`));

  console.log('\n' + chalk.dim('  Will install to:\n'));
  if (ideDirs[ide]) {
    const method = installMethod === 'symlink' ? 'symlink' : 'copy';
    console.log(chalk.green('  ✓ ') + chalk.white(`${ideDirs[ide]}/`) + chalk.dim(` (12 skills, ${method})`));
  }
  console.log(chalk.green('  ✓ ') + chalk.white('.agents/') + chalk.dim(' (12 skills - universal fallback)'));
  console.log(chalk.green('  ✓ ') + chalk.white('.vibe/') + chalk.dim(' (framework files & builds)'));

  const { confirmInstall } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmInstall',
    message: '\n  Proceed with installation?',
    default: true
  }]);

  if (!confirmInstall) {
    console.log(chalk.yellow('\nInstallation cancelled.\n'));
    return;
  }

  console.log('\n' + chalk.blue('─── Installing ─────────────────────────────────────────────────\n'));

  const totalSteps = configureGit ? 6 : 5;

  // Create directory structure
  process.stdout.write(chalk.dim(`  [1/${totalSteps}] Creating directory structure... `));
  await fs.ensureDir(path.join(cwd, '.vibe/builds'));
  await fs.ensureDir(path.join(cwd, '.vibe/core'));
  await fs.ensureDir(path.join(cwd, '.vibe/templates'));
  console.log(chalk.green('✓'));

  // Copy framework files
  process.stdout.write(chalk.dim(`  [2/${totalSteps}] Copying framework files... `));
  const frameworkPath = path.join(__dirname, '../..');
  await copyTemplates(frameworkPath, cwd);
  console.log(chalk.green('✓'));

  // Copy skills based on IDE selection
  process.stdout.write(chalk.dim(`  [3/${totalSteps}] Installing AI assistant skills... `));
  const targetPath = installScope === 'global' ? installLocation : cwd;
  const installedDirs = await copySkills(frameworkPath, targetPath, ide, installMethod);
  console.log(chalk.green('✓'));

  // Create project memory for the selected IDE
  process.stdout.write(chalk.dim(`  [4/${totalSteps}] Creating project memory... `));
  if (installedDirs.length > 0) {
    await createProjectMemory(cwd, ide, installedDirs[0]);
  }
  console.log(chalk.green('✓'));

  // Create CHANGELOG.md in .vibe/ (only if it doesn't exist)
  process.stdout.write(chalk.dim(`  [5/${totalSteps}] Configuring framework... `));
  const changelogPath = path.join(cwd, '.vibe/CHANGELOG.md');
  const changelogExists = fs.existsSync(changelogPath);
  if (!changelogExists) {
    await fs.writeFile(
      changelogPath,
      '# Changelog\n\n## [Unreleased]\n- Initialized vibe-framework\n- Ready for first build\n'
    );
  }

  // Create README.md in .vibe/ (only if it doesn't exist)
  const readmePath = path.join(cwd, '.vibe/README.md');
  const readmeExists = fs.existsSync(readmePath);
  if (!readmeExists) {
    await createQuickReference(cwd);
  }

  // Configure dashboard
  await configureDashboard(cwd);
  await createDefaultLLMConfig(cwd);
  console.log(chalk.green('✓'));

  // Configure Git if requested
  if (configureGit) {
    process.stdout.write(chalk.dim('  [6/6] Configuring Git... '));

    const gitignorePath = path.join(cwd, '.gitignore');
    const gitignoreEntry = '\n# Vibe Framework\n.vibe/builds/\n.vibe/llm-config.json\n';

    if (fs.existsSync(gitignorePath)) {
      const existingContent = await fs.readFile(gitignorePath, 'utf8');
      if (!existingContent.includes('.vibe/builds/')) {
        await fs.appendFile(gitignorePath, gitignoreEntry);
      }
    } else {
      await fs.writeFile(gitignorePath, gitignoreEntry.trim() + '\n');
    }

    console.log(chalk.green('✓'));
  }

  console.log('\n' + chalk.green.bold('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.green.bold('║                    ✅ Installation Complete!                   ║'));
  console.log(chalk.green.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.dim('Files created:\n'));

  console.log(chalk.dim('  .vibe/'));
  console.log('    ├── ' + chalk.white('builds/') + chalk.dim(' (build tracking)'));
  console.log('    ├── ' + chalk.white('core/VIBE.md'));
  console.log('    ├── ' + chalk.white('templates/build/') + chalk.dim(' (9 templates)'));
  console.log('    ├── ' + chalk.white('templates/lite/') + chalk.dim(' (4 templates)'));
  console.log('    ├── ' + chalk.white('llm-config.json') + chalk.dim(' (LLM profiles)'));
  console.log('    ├── ' + (changelogExists ? chalk.dim('CHANGELOG.md (kept)') : chalk.white('CHANGELOG.md')));
  console.log('    ├── ' + (readmeExists ? chalk.dim('README.md (kept)') : chalk.white('README.md')));
  console.log('    └── ' + chalk.white('dashboard-config.json'));

  // Show installed skill directories
  for (const dir of installedDirs) {
    console.log(chalk.dim(`  ${dir}/`));
    console.log('    └── ' + chalk.white('12 skills'));
  }

  console.log('');

  console.log(chalk.cyan('─── Next Steps ─────────────────────────────────────────────────\n'));

  console.log(chalk.white('  1. Generate guards for your project:\n'));
  console.log(chalk.dim('     In your AI assistant, run: ') + chalk.cyan('/guards\n'));

  console.log(chalk.white('  2. Start building features:\n'));
  console.log(chalk.dim('     ') + chalk.cyan('/vibe <fix>') + chalk.dim('      - Quick fixes (1-3 tasks)'));
  console.log(chalk.dim('     ') + chalk.cyan('/lite <feature>') + chalk.dim('  - Medium features (3-8 tasks)'));
  console.log(chalk.dim('     ') + chalk.cyan('/full <feature>') + chalk.dim('  - Complex features (8+ tasks)\n'));

  console.log(chalk.white('  3. View your progress:\n'));
  console.log(chalk.dim('     ') + chalk.cyan('vibe dashboard') + chalk.dim('   - Visual build tracking\n'));

  console.log(chalk.green('🎉 Framework ready for ' + ideNames[ide] + '!\n'));
  if (installScope === 'global') {
    console.log(chalk.dim('💡 Tip: Framework installed globally at ' + installLocation + '\n'));
    console.log(chalk.dim('      Create a project symlink with: ln -s ' + installLocation + '/.vibe .vibe\n'));
  } else {
    console.log(chalk.dim('💡 Tip: All framework files are in .vibe/ - your project root stays clean!\n'));
  }
}

module.exports = init;
