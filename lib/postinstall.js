const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function postinstall() {
  try {
    // Check if Claude Code is installed
    const claudeSkillsDir = path.join(process.env.HOME, '.claude/skills');

    if (fs.existsSync(claudeSkillsDir)) {
      console.log(chalk.blue('📝 Installing Claude Code skills...'));

      const commandsDir = path.join(__dirname, '../adapters/claude/commands');

      if (!fs.existsSync(commandsDir)) {
        console.log(chalk.yellow('⚠️  Commands directory not found, skipping skills installation'));
        return;
      }

      const commands = await fs.readdir(commandsDir);

      for (const cmd of commands) {
        if (cmd.endsWith('.md')) {
          await fs.copy(
            path.join(commandsDir, cmd),
            path.join(claudeSkillsDir, cmd)
          );
        }
      }

      console.log(chalk.green('✅ Claude Code skills installed\n'));
    }
  } catch (error) {
    // Silently fail - postinstall errors shouldn't block package installation
    console.log(chalk.dim('Note: Could not install Claude Code skills automatically'));
  }
}

// Only run if this is a global install or npm link
if (require.main === module) {
  postinstall();
}

module.exports = postinstall;
