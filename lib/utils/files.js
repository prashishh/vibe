const fs = require('fs-extra');
const path = require('path');

async function copyTemplates(frameworkPath, projectPath) {
  // Copy core spec
  await fs.copy(
    path.join(frameworkPath, 'core/VIBE.md'),
    path.join(projectPath, '.vibe/core/VIBE.md')
  );

  // Copy templates
  await fs.copy(
    path.join(frameworkPath, 'templates/build'),
    path.join(projectPath, '.vibe/templates/build')
  );

  await fs.copy(
    path.join(frameworkPath, 'templates/lite'),
    path.join(projectPath, '.vibe/templates/lite')
  );
}

async function configureDashboard(projectPath) {
  const configDir = path.join(projectPath, '.vibe');
  await fs.ensureDir(configDir);

  const config = {
    projectPath,
    buildsPath: path.join(projectPath, '.vibe/builds'),
    guardsPath: path.join(projectPath, '.vibe/GUARDS.md'),
    changelogPath: path.join(projectPath, '.vibe/CHANGELOG.md')
  };

  await fs.writeJson(
    path.join(configDir, 'dashboard-config.json'),
    config,
    { spaces: 2 }
  );
}

async function createDefaultLLMConfig(projectPath) {
  const configPath = path.join(projectPath, '.vibe/llm-config.json');

  if (fs.existsSync(configPath)) {
    return;
  }

  const defaultConfig = {
    version: '1.0',
    execution: {
      mode: 'auto_run',
      preferredRunner: 'claude',
      runners: {
        claude: {
          enabled: true,
          commandTemplate: 'claude --print "{{handoffPrompt}}"'
        },
        codex: {
          enabled: true,
          commandTemplate: 'codex "{{handoffPrompt}}"'
        }
      }
    },
    llms: {
      planning: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        apiKey: '${ANTHROPIC_API_KEY}',
        temperature: 0.7,
        maxTokens: 4096,
        timeoutMs: 180000
      },
      execution: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        apiKey: '${ANTHROPIC_API_KEY}',
        temperature: 0.3,
        maxTokens: 8192,
        timeoutMs: 1800000
      },
      testing: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        apiKey: '${OPENAI_API_KEY}',
        temperature: 0.2,
        maxTokens: 4096,
        timeoutMs: 180000
      },
      guards: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        apiKey: '${OPENAI_API_KEY}',
        temperature: 0.1,
        maxTokens: 4096,
        timeoutMs: 180000
      },
      review: {
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        apiKey: '${ANTHROPIC_API_KEY}',
        temperature: 0.1,
        maxTokens: 8192,
        timeoutMs: 180000
      }
    },
    providers: {
      anthropic: {
        baseUrl: 'https://api.anthropic.com/v1',
        headers: {}
      },
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        headers: {}
      },
      openrouter: {
        baseUrl: 'https://openrouter.ai/api/v1',
        headers: {}
      },
      gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        headers: {}
      }
    }
  };

  await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
}

async function createQuickReference(projectPath) {
  let content = `# Vibe - ${path.basename(projectPath)}\n\n`;
  content += `## Quick Start\n\n`;
  content += `Vibe helps you build software with AI assistance while maintaining quality through guards.\n\n`;
  content += `---\n\n`;
  content += `## Workflow\n\n`;
  content += `### Quick Fixes (1-3 tasks)\n`;
  content += `\`\`\`bash\n`;
  content += `/vibe Fix button alignment\n`;
  content += `# Automatic: implement → check → commit → changelog\n`;
  content += `\`\`\`\n\n`;

  content += `### Medium Features (3-8 tasks)\n`;
  content += `\`\`\`bash\n`;
  content += `/lite Add export feature\n`;
  content += `# Creates GOAL + TASKS → execute all → check → recap\n`;
  content += `\`\`\`\n\n`;

  content += `### Complex Features (8+ tasks)\n`;
  content += `\`\`\`bash\n`;
  content += `/full Implement payment system\n`;
  content += `# Creates all documents → execute all → check → review → ship → recap\n`;
  content += `\`\`\`\n\n`;

  content += `### Manual Step-by-Step\n`;
  content += `\`\`\`bash\n`;
  content += `/plan Add notifications      # Create build\n`;
  content += `/execute                     # Work on next task (repeat)\n`;
  content += `/check                       # Run all guards\n`;
  content += `/recap                       # Close build\n`;
  content += `\`\`\`\n\n`;

  content += `---\n\n`;
  content += `## Commands Available\n\n`;
  content += `### Setup (done! ✅)\n`;
  content += `- \`vibe init\` or \`/start\` - Initialize framework\n\n`;

  content += `### Guards (do this first!)\n`;
  content += `- \`/guards\` - Analyze codebase and create guards (uses AI)\n\n`;

  content += `### Building\n`;
  content += `- \`/vibe <fix>\` - Quick fixes (autonomous)\n`;
  content += `- \`/lite <feature>\` - Medium features (autonomous)\n`;
  content += `- \`/full <feature>\` - Complex features (autonomous)\n`;
  content += `- \`/plan <feature>\` - Create build manually\n`;
  content += `- \`/execute\` - Work on next task\n`;
  content += `- \`/check\` - Run all guards\n`;
  content += `- \`/review\` - Review findings\n`;
  content += `- \`/ship\` - Deployment checklist\n`;
  content += `- \`/recap\` - Close build\n`;
  content += `- \`/propose\` - Suggest next build\n\n`;

  content += `### Dashboard\n`;
  content += `- \`vibe dashboard\` - Start visual dashboard\n\n`;

  content += `---\n\n`;
  content += `## Next Steps\n\n`;
  content += `1. **Create guards:** Run \`/guards\` to analyze your codebase\n`;
  content += `2. **Start building:** Use \`/vibe\`, \`/lite\`, or \`/full\`\n`;
  content += `3. **View progress:** Run \`vibe dashboard\`\n\n`;
  content += `🎉 **Framework initialized! Use /guards to get started.**\n`;

  await fs.writeFile(path.join(projectPath, '.vibe/README.md'), content);
}

async function copySkills(frameworkPath, projectPath, ide, installMethod = 'copy') {
  const skillsSourceDir = path.join(frameworkPath, 'adapters/claude/commands');
  const installedDirs = [];

  // IDE-specific directory mapping (verified from docs/skills.sh 2026)
  const ideConfig = {
    claude: { dir: '.claude/skills', format: 'subdirs', memoryFile: '.claude/CLAUDE.md' },
    codex: { dir: '.agents/skills', format: 'subdirs', memoryFile: '.agents/README.md' },
    cursor: { dir: '.cursor/skills', format: 'subdirs', memoryFile: '.cursor/memory.md' },
    windsurf: { dir: '.windsurf/skills', format: 'subdirs', memoryFile: '.windsurf/memory.md' },
    copilot: { dir: '.github/skills', format: 'subdirs', memoryFile: '.github/copilot.md' },
    aider: { dir: '.aider/skills', format: 'subdirs', memoryFile: '.aider/skills.md' },
    cline: { dir: '.cline/skills', format: 'subdirs', memoryFile: '.cline/memory.md' },
    cody: { dir: '.agents/skills', format: 'subdirs', memoryFile: '.agents/README.md' },
    continue: { dir: '.continue/skills', format: 'subdirs', memoryFile: '.continue/memory.md' },
    devin: { dir: '.devin/skills', format: 'subdirs', memoryFile: '.devin/memory.md' },
    replit: { dir: '.replit/skills', format: 'subdirs', memoryFile: '.replit/agent.md' },
    roo: { dir: '.roo/skills', format: 'subdirs', memoryFile: '.roo/memory.md' },
    tabnine: { dir: '.agents/skills', format: 'subdirs', memoryFile: '.agents/README.md' },
    zed: { dir: '.agents/skills', format: 'subdirs', memoryFile: '.agents/README.md' }
  };

  // Get all .md files from adapters/claude/commands/
  const skillFiles = await fs.readdir(skillsSourceDir);
  const mdFiles = skillFiles.filter(f => f.endsWith('.md'));

  // Helper function to install skills (copy or symlink)
  const installSkill = async (sourcePath, targetPath) => {
    if (installMethod === 'symlink') {
      // Create symlink
      await fs.ensureDir(path.dirname(targetPath));
      try {
        await fs.symlink(sourcePath, targetPath, 'file');
      } catch (err) {
        // If symlink fails, fall back to copy
        if (err.code === 'EEXIST') {
          await fs.remove(targetPath);
          await fs.symlink(sourcePath, targetPath, 'file');
        } else {
          await fs.copy(sourcePath, targetPath);
        }
      }
    } else {
      // Copy file
      await fs.copy(sourcePath, targetPath);
    }
  };

  // Always create .agents/ (universal fallback)
  const agentsSkillsDir = path.join(projectPath, '.agents/skills');
  await fs.ensureDir(agentsSkillsDir);
  installedDirs.push('.agents');

  for (const file of mdFiles) {
    const skillName = path.basename(file, '.md');

    // Install to .agents/skills/<skill-name>/SKILL.md (Agent Skills standard - always)
    const agentSkillDir = path.join(agentsSkillsDir, skillName);
    await fs.ensureDir(agentSkillDir);
    await installSkill(
      path.join(skillsSourceDir, file),
      path.join(agentSkillDir, 'SKILL.md')
    );
  }

  // Install to IDE-specific directory if not "other"
  if (ide !== 'other' && ideConfig[ide]) {
    const config = ideConfig[ide];
    const ideSkillsDir = path.join(projectPath, config.dir);
    await fs.ensureDir(ideSkillsDir);
    installedDirs.push(config.dir);

    for (const file of mdFiles) {
      const skillName = path.basename(file, '.md');

      if (config.format === 'subdirs') {
        // Subdirectory format: .ide/skills/<skill-name>/SKILL.md
        const skillDir = path.join(ideSkillsDir, skillName);
        await fs.ensureDir(skillDir);
        await installSkill(
          path.join(skillsSourceDir, file),
          path.join(skillDir, 'SKILL.md')
        );
      } else {
        // Flat format: .ide/skills/<skill-name>.md
        await installSkill(
          path.join(skillsSourceDir, file),
          path.join(ideSkillsDir, file)
        );
      }
    }
  }

  return installedDirs;
}

async function createProjectMemory(projectPath, ide, skillsDir) {
  const content = `# Vibe Project

This project uses Vibe for AI-assisted software delivery.

## Available Skills

Use these slash commands:
- \`/vibe <fix>\` - Quick fixes (1-3 tasks, autonomous)
- \`/lite <feature>\` - Medium features (3-8 tasks, autonomous)
- \`/full <feature>\` - Complex features (8+ tasks, autonomous)
- \`/guards\` - Analyze codebase and generate safety guards
- \`/check\` - Verify all guards pass
- \`/plan\`, \`/execute\`, \`/review\`, \`/ship\`, \`/recap\` - Manual step-by-step workflow

## Framework Structure

- \`.vibe/\` - Framework files and templates
  - \`builds/\` - Build directories (v1, v2, ...)
  - \`GUARDS.md\` - Safety contracts (generate with \`/guards\`)
  - \`CHANGELOG.md\` - Auto-maintained changelog
  - \`README.md\` - This documentation
- \`${skillsDir}/\` - Skills for your AI assistant
- \`.agents/\` - Universal skills fallback

## Workflow

1. Generate guards: \`/guards\`
2. Build features: \`/vibe\`, \`/lite\`, or \`/full\`
3. View dashboard: \`vibe dashboard\`

All framework files are in \`.vibe/\` - access via CLI commands or dashboard.
`;

  // IDE-specific memory file paths (verified from docs/skills.sh 2026)
  const memoryFiles = {
    claude: '.claude/CLAUDE.md',
    codex: '.agents/README.md',
    cursor: '.cursor/memory.md',
    windsurf: '.windsurf/memory.md',
    copilot: '.github/copilot.md',
    aider: '.aider/skills.md',
    cline: '.cline/memory.md',
    cody: '.agents/README.md',
    continue: '.continue/memory.md',
    devin: '.devin/memory.md',
    replit: '.replit/agent.md',
    roo: '.roo/memory.md',
    tabnine: '.agents/README.md',
    zed: '.agents/README.md'
  };

  // Create memory file for the selected IDE (skip for "other")
  if (ide !== 'other' && memoryFiles[ide]) {
    const memoryPath = path.join(projectPath, memoryFiles[ide]);
    await fs.ensureDir(path.dirname(memoryPath));
    await fs.writeFile(memoryPath, content);
  }

  // Always create .agents/README.md as fallback
  await fs.writeFile(
    path.join(projectPath, '.agents/README.md'),
    content
  );
}

module.exports = {
  copyTemplates,
  configureDashboard,
  createDefaultLLMConfig,
  createQuickReference,
  copySkills,
  createProjectMemory
};
