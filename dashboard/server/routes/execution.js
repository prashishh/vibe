const express = require('express');
const { getTasks } = require('../services/tasks-store');
const { resolveRunnerCommand } = require('../execution/runner');
const eventBus = require('../services/event-bus');

function createExecutionRouter(executionEngine) {
  const router = express.Router();

  router.get('/running/:buildId?', async (req, res) => {
    const { buildId } = req.params;
    const running = executionEngine.listRunning(buildId);
    res.json({ running });
  });

  router.post('/:buildId/:taskId/start', async (req, res) => {
    try {
      const { buildId, taskId } = req.params;
      const { command: overrideCommand, cwd } = req.body || {};

      const parsed = await getTasks(buildId);
      const task = parsed.tasks.find(item => item.id === taskId);
      if (!task) {
        return res.status(404).json({ error: `Task not found: ${taskId}` });
      }

      let command = overrideCommand;
      let mode = 'custom';
      let runner = 'custom';
      let handoffPrompt = '';
      let reason = '';
      let isStreamJson = false;

      if (!command) {
        const resolved = await resolveRunnerCommand({ buildId, task });
        mode = resolved.mode;
        runner = resolved.runner || '';
        handoffPrompt = resolved.handoffPrompt || '';
        reason = resolved.reason || '';
        command = resolved.command || '';
        isStreamJson = resolved.isStreamJson || false;

        // Log runner resolution to Live Output so user can see what happened
        if (command) {
          eventBus.broadcast(buildId, 'execution-log', {
            buildId,
            taskId,
            stream: 'system',
            message: `Runner resolved: ${runner} (${mode})`,
            timestamp: new Date().toISOString(),
          });
        } else {
          eventBus.broadcast(buildId, 'execution-log', {
            buildId,
            taskId,
            stream: 'warning',
            message: `No runner command for ${taskId}: ${reason || 'no enabled runner found'}. Task entered manual handoff mode.`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const started = await executionEngine.start({
        buildId,
        taskId,
        command,
        cwd,
        handoffPrompt,
        isStreamJson,
        runnerName: runner,
      });

      const responseMode = overrideCommand
        ? 'custom'
        : (command ? 'auto_run' : mode);

      res.status(202).json({
        started: {
          ...started,
          mode: responseMode,
          runner,
          handoffPrompt,
          reason,
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/:buildId/:taskId/cancel', async (req, res) => {
    try {
      const { buildId, taskId } = req.params;
      const cancelled = await executionEngine.cancel(buildId, taskId);
      res.json({ cancelled });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createExecutionRouter;
