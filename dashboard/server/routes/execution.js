const express = require('express');
const { getTasks } = require('../services/tasks-store');
const { resolveRunnerCommand } = require('../execution/runner');
const eventBus = require('../services/event-bus');

async function buildStartPayload({
  buildId,
  task,
  overrideCommand,
  cwd,
  emitResolutionLog = true,
}) {
  const taskId = task.id;

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

    if (emitResolutionLog) {
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
  }

  const responseMode = overrideCommand
    ? 'custom'
    : (command ? 'auto_run' : mode);

  return {
    startPayload: {
      buildId,
      taskId,
      command,
      cwd,
      handoffPrompt,
      isStreamJson,
      runnerName: runner,
    },
    responseMeta: {
      mode: responseMode,
      runner,
      handoffPrompt,
      reason,
    },
  };
}

function createExecutionRouter(executionEngine) {
  const router = express.Router();

  router.get('/running/:buildId?', async (req, res) => {
    const { buildId } = req.params;
    const running = executionEngine.listRunning(buildId);
    res.json({ running });
  });

  router.get('/queue/:buildId', async (req, res) => {
    const { buildId } = req.params;
    res.json({ queue: executionEngine.getQueueState(buildId) });
  });

  router.post('/:buildId/start-pending', async (req, res) => {
    try {
      const { buildId } = req.params;
      const { maxConcurrent, cwd } = req.body || {};
      const requestedStatuses = Array.isArray(req.body?.statuses) && req.body.statuses.length > 0
        ? req.body.statuses
        : ['pending'];
      const statuses = new Set(requestedStatuses.map(value => String(value || '').trim().toLowerCase()));

      const parsed = await getTasks(buildId);
      const tasks = parsed.tasks || [];
      const queueableTasks = tasks.filter(task => statuses.has(String(task.status || '').toLowerCase()));

      if (queueableTasks.length === 0) {
        return res.status(200).json({
          queued: {
            buildId,
            enqueuedCount: 0,
            matchedTaskCount: 0,
            queue: executionEngine.getQueueState(buildId),
          },
        });
      }

      const entries = [];
      for (const task of queueableTasks) {
        const { startPayload } = await buildStartPayload({
          buildId,
          task,
          overrideCommand: '',
          cwd,
          emitResolutionLog: false,
        });
        entries.push({
          ...startPayload,
          title: task.title,
        });
      }

      const queued = await executionEngine.startBuildQueue({
        buildId,
        entries,
        maxConcurrent,
      });

      res.status(202).json({
        queued: {
          buildId,
          matchedTaskCount: queueableTasks.length,
          ...queued,
        },
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
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

      const { startPayload, responseMeta } = await buildStartPayload({
        buildId,
        task,
        overrideCommand,
        cwd,
        emitResolutionLog: true,
      });
      const started = await executionEngine.start(startPayload);

      res.status(202).json({
        started: {
          ...started,
          ...responseMeta,
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
