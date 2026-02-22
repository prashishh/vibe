const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const eventBus = require('./services/event-bus');
const createTaskRouter = require('./routes/tasks');
const createLLMRouter = require('./routes/llm');
const createExecutionRouter = require('./routes/execution');
const createGuardsRouter = require('./routes/guards');
const createGitRouter = require('./routes/git');
const ExecutionEngine = require('./execution/engine');
const { setupSSE } = require('./websocket');
const { setupMarkdownSync } = require('./sync/markdown');
const { resolveBuildsRoot } = require('./services/tasks-store');
const { checkGhCli } = require('./services/git-service');

dotenv.config();

const app = express();
const executionEngine = new ExecutionEngine(eventBus);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    buildsRoot: resolveBuildsRoot(),
    projectPath: process.env.VIBE_PROJECT_PATH || process.cwd(),
    now: new Date().toISOString(),
  });
});

app.use('/api/tasks', createTaskRouter(eventBus));
app.use('/api/llm', createLLMRouter());
app.use('/api/execution', createExecutionRouter(executionEngine));
app.use('/api/guards', createGuardsRouter());
app.use('/api/git', createGitRouter());

setupSSE(app, eventBus);

// JSON 404 catch-all — must be registered after all routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `No route matched: ${req.method} ${req.originalUrl}`,
  });
});

const watcher = setupMarkdownSync(eventBus);

const PORT = Number(process.env.VIBE_API_PORT || 3001);
const server = app.listen(PORT, () => {
  console.log(`Vibe server running on http://localhost:${PORT}`);

  // Non-blocking gh CLI availability check (informational only)
  try {
    const gh = checkGhCli();
    if (!gh.installed) {
      console.warn('[vibe] gh CLI not found — PR creation unavailable. See https://cli.github.com/');
    } else if (!gh.authenticated) {
      console.warn('[vibe] gh CLI found but not authenticated. Run: gh auth login');
    }
  } catch {
    // ignore — gh check should never crash the server
  }
});

process.on('SIGINT', async () => {
  await watcher.close();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  await watcher.close();
  server.close(() => process.exit(0));
});
