const express = require('express');
const {
  listBuilds,
  assistBuild,
  createBuild,
  planBuild,
  updateBuildStatus,
  deleteBuild,
  getBuildDocs,
  saveBuildDoc,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  readBuildMeta,
  writeBuildMeta,
  lockAndWriteMeta,
  resolveProjectRoot,
} = require('../services/tasks-store');
const gitService = require('../services/git-service');
const { buildTaskFromPrompt } = require('../llm/client');
const { runPlanning } = require('../execution/planner');
const { runFeedback } = require('../execution/feedback');

function createTaskRouter(eventBus) {
  const router = express.Router();

  const RESERVED_SEGMENTS = new Set(['builds']);

  function rejectReservedBuildId(req, res, next) {
    if (RESERVED_SEGMENTS.has(req.params.buildId)) {
      return res.status(400).json({
        error: `"${req.params.buildId}" is a reserved path segment, not a valid build id`,
      });
    }
    next();
  }

  router.get('/', async (req, res) => {
    try {
      const builds = await listBuilds();
      res.json({ builds });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/builds/assist', async (req, res) => {
    try {
      const description = String(req.body?.description || '').trim();
      const buildType = String(req.body?.buildType || 'lite');
      const customType = String(req.body?.customType || '').trim();

      if (!description) {
        return res.status(400).json({ error: 'Build description is required' });
      }

      const suggestion = await assistBuild({ description, buildType, customType });
      return res.json({ suggestion });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/builds', async (req, res) => {
    try {
      const description = String(req.body?.description || '').trim();
      const buildType = String(req.body?.buildType || 'lite');
      const customType = String(req.body?.customType || '').trim();

      if (!description) {
        return res.status(400).json({ error: 'Build description is required' });
      }

      const created = await createBuild({ description, buildType, customType });
      const builds = await listBuilds();

      return res.status(201).json({
        build: created,
        builds,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.post('/builds/:buildId/plan', async (req, res) => {
    try {
      const { buildId } = req.params;

      // Guard: if build is already planned, return current state instead of erroring
      const existingMeta = await readBuildMeta(buildId);
      if (existingMeta && existingMeta.status && existingMeta.status !== 'pending') {
        eventBus.broadcast(buildId, 'execution-log', {
          buildId,
          taskId: null,
          stream: 'system',
          message: `Build ${buildId} is already in ${existingMeta.status} state — skipping re-plan.`,
          timestamp: new Date().toISOString(),
        });
        const builds = await listBuilds();
        return res.json({
          build: { buildId, status: existingMeta.status, description: existingMeta.description },
          builds,
        });
      }

      // Return 202 immediately so the frontend can establish the SSE connection
      // before planning events start firing. Planning runs in the background and
      // streams progress via SSE (execution-log events). On completion it emits
      // build-status-changed so the frontend refreshes.
      res.status(202).json({
        build: { buildId, status: 'pending', description: existingMeta?.description },
        planning: true,
      });

      // Run planning in the background — all progress streams via SSE
      (async () => {
        let finalStatus = 'planning';
        try {
          const result = await runPlanning({ buildId, eventBus });
          finalStatus = result?.status || 'planning';
        } catch (runnerErr) {
          console.warn(`Runner planning failed for ${buildId}, falling back to templates: ${runnerErr.message}`);

          eventBus.broadcast(buildId, 'execution-log', {
            buildId,
            taskId: null,
            stream: 'warning',
            message: `CLI runner failed: ${runnerErr.message}`,
            timestamp: new Date().toISOString(),
          });
          eventBus.broadcast(buildId, 'execution-log', {
            buildId,
            taskId: null,
            stream: 'system',
            message: 'Falling back to template-based planning...',
            timestamp: new Date().toISOString(),
          });

          try {
            await planBuild(buildId);
            finalStatus = 'planning';
          } catch (fallbackErr) {
            eventBus.broadcast(buildId, 'execution-log', {
              buildId,
              taskId: null,
              stream: 'error',
              message: `Planning failed: ${fallbackErr.message}`,
              timestamp: new Date().toISOString(),
            });
            try {
              await updateBuildStatus(buildId, 'blocked', { validate: false });
              finalStatus = 'blocked';
            } catch {
              // If meta update fails, keep default status for UI refresh fallback
            }
          }
        }

        // Notify frontend that planning is done — triggers builds/tasks refresh
        eventBus.broadcast(buildId, 'build-status-changed', {
          buildId,
          status: finalStatus,
          timestamp: new Date().toISOString(),
        });
      })();
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.post('/builds/:buildId/chat', async (req, res) => {
    try {
      const { buildId } = req.params;
      const message = String(req.body?.message || '').trim();
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const result = await runFeedback({ buildId, message, eventBus });
      const meta = await readBuildMeta(buildId);

      // Clear open questions once user answers via chat.
      if (Array.isArray(meta?.openQuestions) && meta.openQuestions.length > 0) {
        let nextStatus = meta?.status || 'planning';
        if (meta?.status === 'blocked' && /planning needs clarification/i.test(meta?.blockedReason || '')) {
          await updateBuildStatus(buildId, 'planning', { validate: false });
          nextStatus = 'planning';
        }
        await lockAndWriteMeta(buildId, (m) => {
          m.openQuestions = [];
          if (/planning needs clarification/i.test(m.blockedReason || '')) {
            m.blockedReason = '';
          }
        });
        eventBus.broadcast(buildId, 'execution-log', {
          buildId,
          taskId: null,
          stream: 'success',
          message: 'Clarifications received. Open questions cleared.',
          timestamp: new Date().toISOString(),
        });
        eventBus.broadcast(buildId, 'build-status-changed', {
          buildId,
          status: nextStatus,
          timestamp: new Date().toISOString(),
        });
      }

      const builds = await listBuilds();
      return res.json({ result, builds });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Generate RECAP.md automatically using the runner/feedback mechanism
  router.post('/builds/:buildId/recap', async (req, res) => {
    try {
      const { buildId } = req.params;

      eventBus.broadcast(buildId, 'execution-log', {
        buildId,
        taskId: null,
        stream: 'system',
        message: 'Generating RECAP.md...',
        timestamp: new Date().toISOString(),
      });

      // Read existing docs + tasks to build context for the recap
      const docs = await getBuildDocs(buildId);
      const meta = await readBuildMeta(buildId);
      let taskSummary = '';
      try {
        const parsed = await getTasks(buildId);
        const tasks = parsed.tasks || [];
        const done = tasks.filter(t => t.status === 'review' || t.status === 'deployed');
        const blocked = tasks.filter(t => t.status === 'blocked');
        taskSummary = `${done.length}/${tasks.length} tasks completed` + (blocked.length > 0 ? `, ${blocked.length} blocked` : '');
      } catch { taskSummary = 'No task data'; }

      const goalContent = docs['GOAL.md'] || '';
      const desc = meta?.description || '';

      // Build the recap content directly (no runner needed for a structured template)
      const recap = [
        `# Recap — ${buildId}`,
        '',
        `## Summary`,
        desc || '(describe what this cycle accomplished)',
        '',
        `## Goal`,
        goalContent ? goalContent.replace(/^# .*/m, '').trim().slice(0, 300) : '(no goal document)',
        '',
        `## Results`,
        `- Tasks: ${taskSummary}`,
        `- Status: ${meta?.status || 'unknown'}`,
        `- Shipped: ${new Date().toISOString().split('T')[0]}`,
        '',
        `## What Went Well`,
        `- `,
        '',
        `## What Could Improve`,
        `- `,
        '',
        `## Follow-ups`,
        `- `,
        '',
      ].join('\n');

      await saveBuildDoc(buildId, 'RECAP.md', recap);

      eventBus.broadcast(buildId, 'execution-log', {
        buildId,
        taskId: null,
        stream: 'success',
        message: 'RECAP.md generated. Edit it in the Recap tab to add your retrospective.',
        timestamp: new Date().toISOString(),
      });

      const builds = await listBuilds();
      return res.json({ recap, builds });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.patch('/builds/:buildId/status', async (req, res) => {
    try {
      const { buildId } = req.params;
      const status = String(req.body?.status || '').trim();
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      const result = await updateBuildStatus(buildId, status);

      // When transitioning to in_progress: set up git build branch
      if (status === 'in_progress') {
        const meta = await readBuildMeta(buildId);
        const projectRoot = meta?.projectRoot || resolveProjectRoot();

        if (gitService.isGitRepo(projectRoot)) {
          try {
            const branchName = `vibe/${buildId}`;
            gitService.createBuildBranch(projectRoot, branchName);
            gitService.ensureGitignoreEntry(projectRoot, '.vibe/worktrees/');

            await lockAndWriteMeta(buildId, (m) => {
              m.branchName = branchName;
              m.gitEnabled = true;
            });

            eventBus.broadcast(buildId, 'execution-log', {
              buildId,
              taskId: null,
              stream: 'system',
              message: `Git: created build branch "${branchName}"`,
              timestamp: new Date().toISOString(),
            });
          } catch (gitErr) {
            eventBus.broadcast(buildId, 'execution-log', {
              buildId,
              taskId: null,
              stream: 'warning',
              message: `Git branch setup failed: ${gitErr.message}`,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          eventBus.broadcast(buildId, 'execution-log', {
            buildId,
            taskId: null,
            stream: 'warning',
            message: 'Git not detected in project root — worktree isolation disabled.',
            timestamp: new Date().toISOString(),
          });
        }
      }

      const builds = await listBuilds();
      return res.json({ build: result, builds });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.delete('/builds/:buildId', async (req, res) => {
    try {
      const { buildId } = req.params;
      const result = await deleteBuild(buildId);
      const builds = await listBuilds();
      return res.json({ deleted: result, builds });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.get('/builds/:buildId/docs', async (req, res) => {
    try {
      const { buildId } = req.params;
      const docs = await getBuildDocs(buildId);
      return res.json({ buildId, docs });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.put('/builds/:buildId/docs/:docName', async (req, res) => {
    try {
      const { buildId, docName } = req.params;
      const content = String(req.body?.content ?? '');
      const result = await saveBuildDoc(buildId, docName, content);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  // Persisted logs — returns the LOG.jsonl entries for resilience across page refreshes
  router.get('/builds/:buildId/logs', async (req, res) => {
    try {
      const { buildId } = req.params;
      const { buildDirPath } = require('../services/tasks-store');
      const fsPromises = require('fs/promises');
      const logFile = require('path').join(buildDirPath(buildId), 'LOG.jsonl');

      let lines = [];
      try {
        const raw = await fsPromises.readFile(logFile, 'utf8');
        lines = raw.trim().split('\n').filter(Boolean).map(line => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
      } catch {
        // No log file yet — return empty
      }

      return res.json({ buildId, logs: lines });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.get('/:buildId', rejectReservedBuildId, async (req, res) => {
    try {
      const { buildId } = req.params;
      const parsed = await getTasks(buildId);
      res.json({
        buildId,
        format: parsed.format,
        tasks: parsed.tasks,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/:buildId/enhance', rejectReservedBuildId, async (req, res) => {
    try {
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const suggestion = buildTaskFromPrompt(prompt);
      return res.json({ suggestion });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:buildId', rejectReservedBuildId, async (req, res) => {
    try {
      const { buildId } = req.params;
      const payload = req.body || {};
      const taskData = payload.prompt
        ? buildTaskFromPrompt(payload.prompt)
        : payload;

      const task = await createTask(buildId, taskData);
      const parsed = await getTasks(buildId);

      eventBus.broadcast(buildId, 'tasks-updated', {
        buildId,
        tasks: parsed.tasks,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({ task });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/:buildId/:taskId', rejectReservedBuildId, async (req, res) => {
    try {
      const { buildId, taskId } = req.params;
      const task = await updateTask(buildId, taskId, req.body || {});
      const parsed = await getTasks(buildId);

      eventBus.broadcast(buildId, 'tasks-updated', {
        buildId,
        tasks: parsed.tasks,
        timestamp: new Date().toISOString(),
      });

      eventBus.broadcast(buildId, 'task-status-changed', {
        buildId,
        taskId,
        status: task.status,
        timestamp: new Date().toISOString(),
      });

      res.json({ task });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/:buildId/:taskId', rejectReservedBuildId, async (req, res) => {
    try {
      const { buildId, taskId } = req.params;
      const removed = await deleteTask(buildId, taskId);
      const parsed = await getTasks(buildId);

      eventBus.broadcast(buildId, 'tasks-updated', {
        buildId,
        tasks: parsed.tasks,
        timestamp: new Date().toISOString(),
      });

      res.json({ removed });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/:buildId/reorder', rejectReservedBuildId, async (req, res) => {
    try {
      const { buildId } = req.params;
      const orderedTaskIds = Array.isArray(req.body?.orderedTaskIds)
        ? req.body.orderedTaskIds
        : [];

      const tasks = await reorderTasks(buildId, orderedTaskIds);

      eventBus.broadcast(buildId, 'tasks-updated', {
        buildId,
        tasks,
        timestamp: new Date().toISOString(),
      });

      res.json({ tasks });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createTaskRouter;
