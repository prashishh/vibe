const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

async function ensureDepsInstalled(packageDir, label) {
  const nodeModules = path.join(packageDir, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    return;
  }

  console.log(chalk.yellow(`📦 Installing ${label} dependencies (first time only)...`));
  const installChild = spawn('npm', ['install'], {
    cwd: packageDir,
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    installChild.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to install dependencies for ${label}`));
    });
  });
}

async function dashboard() {
  const cwd = process.cwd();

  const configPath = path.join(cwd, '.vibe/dashboard-config.json');
  if (!fs.existsSync(configPath)) {
    console.log(chalk.red('❌ Dashboard not configured. Run "vibe init" first.'));
    return;
  }

  const config = await fs.readJson(configPath);

  const dashboardAppPath = path.join(__dirname, '../../dashboard/app');
  const dashboardApiPath = path.join(__dirname, '../../dashboard/server');
  const apiPort = Number(process.env.VIBE_API_PORT || 3001);

  await ensureDepsInstalled(dashboardAppPath, 'dashboard app');
  await ensureDepsInstalled(dashboardApiPath, 'dashboard API');

  console.log(chalk.blue('🚀 Starting dashboard...\n'));
  console.log(`Project: ${chalk.green(path.basename(config.projectPath))}`);
  console.log(`Builds: ${config.buildsPath}`);
  console.log(`Guards: ${config.guardsPath}`);
  console.log(`API: ${chalk.green(`http://localhost:${apiPort}`)}`);
  console.log(chalk.dim('Press Ctrl+C to stop\n'));

  const apiChild = spawn('npm', ['run', 'dev'], {
    cwd: dashboardApiPath,
    env: {
      ...process.env,
      VIBE_PROJECT_PATH: config.projectPath,
      VIBE_BUILDS_PATH: config.buildsPath,
      VIBE_GUARDS_PATH: config.guardsPath,
      VIBE_CHANGELOG_PATH: config.changelogPath,
      VIBE_LLM_CONFIG_PATH: path.join(config.projectPath, '.vibe/llm-config.json'),
      VIBE_API_PORT: String(apiPort),
    },
    stdio: 'inherit',
  });

  const viteChild = spawn('npm', ['run', 'dev'], {
    cwd: dashboardAppPath,
    env: {
      ...process.env,
      VITE_BUILDS_PATH: config.buildsPath,
      VITE_GUARDS_PATH: config.guardsPath,
      VITE_CHANGELOG_PATH: config.changelogPath,
      VITE_API_URL: `http://localhost:${apiPort}`,
    },
    stdio: 'inherit',
  });

  const terminate = () => {
    apiChild.kill('SIGINT');
    viteChild.kill('SIGINT');
  };

  apiChild.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(chalk.red(`\n❌ API server exited with code ${code}`));
    }
  });

  viteChild.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(chalk.red(`\n❌ Dashboard UI exited with code ${code}`));
    }
  });

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nStopping dashboard...'));
    terminate();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    terminate();
    process.exit(0);
  });
}

module.exports = dashboard;
