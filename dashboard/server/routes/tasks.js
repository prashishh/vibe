const express = require('express');
const crypto = require('crypto');
const fsPromises = require('fs/promises');
const path = require('path');
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
  buildDirPath,
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

  // ── Chat history ──────────────────────────────────────────────────────────
  router.get('/builds/:buildId/chat', async (req, res) => {
    try {
      const { buildId } = req.params;
      const chatFile = path.join(buildDirPath(buildId), 'CHAT.jsonl');
      let messages = [];
      try {
        const raw = await fsPromises.readFile(chatFile, 'utf8');
        messages = raw.trim().split('\n').filter(Boolean).map(line => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
      } catch {
        // No chat file yet — return empty
      }
      return res.json({ buildId, messages });
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

      // Emit structured chat-message for the user's message
      const userMsgId = `msg-user-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      eventBus.broadcast(buildId, 'chat-message', {
        id: userMsgId,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        activity: [],
      });

      const result = await runFeedback({ buildId, message, eventBus });

      // Emit structured chat-message for the assistant's response
      const assistantMsgId = `msg-asst-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      const updatedFiles = result.updatedFiles || [];
      const assistantContent = updatedFiles.length > 0
        ? `Updated ${updatedFiles.map(f => `**${f}**`).join(', ')}.`
        : 'No changes needed.';
      eventBus.broadcast(buildId, 'chat-message', {
        id: assistantMsgId,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        activity: result.activity || [],
      });

      const meta = await readBuildMeta(buildId);
      const openQuestions = Array.isArray(meta?.openQuestions) ? meta.openQuestions : [];
      const hasNeedsInput = Array.isArray(meta?.needsInput?.questions) && meta.needsInput.questions.length > 0;

      // Clear open questions once user answers via chat.
      if (openQuestions.length > 0 || hasNeedsInput) {
        let nextStatus = meta?.status || 'planning';
        if (meta?.status === 'blocked' && /planning needs clarification/i.test(meta?.blockedReason || '')) {
          await updateBuildStatus(buildId, 'planning', { validate: false });
          nextStatus = 'planning';
        }
        await lockAndWriteMeta(buildId, (m) => {
          m.openQuestions = [];
          m.needsInput = null;
          if (/planning needs clarification/i.test(m.blockedReason || '')) {
            m.blockedReason = '';
          }
        });
        eventBus.broadcast(buildId, 'execution-log', {
          buildId,
          taskId: null,
          stream: 'success',
          message: 'Clarifications received. Needs-input state cleared.',
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
      const logFile = path.join(buildDirPath(buildId), 'LOG.jsonl');

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

  // Process-level logs — persisted incremental stdout/stderr chunks grouped by processId
  router.get('/builds/:buildId/process-logs', async (req, res) => {
    try {
      const { buildId } = req.params;
      const runId = String(req.query?.runId || '').trim();
      const limitRaw = Number.parseInt(String(req.query?.limit || '5000'), 10);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50000)) : 5000;
      const runsDir = path.join(buildDirPath(buildId), 'runs');

      let fileNames = [];
      try {
        const entries = await fsPromises.readdir(runsDir, { withFileTypes: true });
        fileNames = entries
          .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
          .map(entry => entry.name);
      } catch {
        return res.json({ buildId, runId: runId || null, logs: [] });
      }

      if (runId) {
        const safe = runId.replace(/[^A-Za-z0-9._-]/g, '_');
        fileNames = fileNames.filter(name => name === `${safe}.jsonl`);
      }

      const logs = [];
      for (const fileName of fileNames.sort()) {
        const filePath = path.join(runsDir, fileName);
        let raw = '';
        try {
          raw = await fsPromises.readFile(filePath, 'utf8');
        } catch {
          continue;
        }

        const lines = raw.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            logs.push(JSON.parse(line));
          } catch {
            // ignore malformed lines
          }
        }
      }

      logs.sort((a, b) => {
        const ta = Date.parse(a?.ts || '');
        const tb = Date.parse(b?.ts || '');
        if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
        return Number(a?.eventId || 0) - Number(b?.eventId || 0);
      });

      const tail = logs.slice(-limit);
      return res.json({
        buildId,
        runId: runId || null,
        logs: tail,
        total: logs.length,
      });
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
