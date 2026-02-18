const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const chokidar = require('chokidar');
const { updateTask, getTasks, readBuildMeta, updateBuildStatus, updateTaskMeta, resolveProjectRoot } = require('../services/tasks-store');
const gitService = require('../services/git-service');
const { createStreamProcessor } = require('./stream-parser');

function extractQuestions(output) {
  const ansiPattern = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
  const ignoreQuestionPattern = /^(ready to proceed\?|proceed\?|continue\?|should i proceed\?|say\s+[`'"]?(yes|ok|\/execute)[`'"]?.*)$/i;
  const questions = [];
  const seen = new Set();
  const lines = String(output || '').split('\n');

  for (const rawLine of lines) {
    const cleaned = rawLine
      .replace(ansiPattern, '')
      .replace(/^\s*[-*>\d.)]+\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned || cleaned === '?') continue;
    if (cleaned.startsWith('#')) continue;
    if (!cleaned.includes('?')) continue;

    let normalized = cleaned;
    const qMark = cleaned.indexOf('?');
    if (qMark >= 0) normalized = cleaned.slice(0, qMark + 1).trim();
    normalized = normalized.replace(/^[:\-–—]\s*/, '');

    const alnumCount = normalized.replace(/[^A-Za-z0-9]/g, '').length;
    if (alnumCount < 8) continue;
    if (ignoreQuestionPattern.test(normalized)) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    questions.push(normalized);
    if (questions.length >= 5) break;
  }

  return questions;
}

class ExecutionEngine {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.running = new Map();
    this.buildQueues = new Map();
    this.defaultMaxConcurrent = 2;
  }

  key(buildId, taskId) {
    return `${buildId}:${taskId}`;
  }

  isRunning(buildId, taskId) {
    return this.running.has(this.key(buildId, taskId));
  }

  listRunning(buildId) {
    const tasks = [];
    for (const [key, value] of this.running.entries()) {
      if (!buildId || key.startsWith(`${buildId}:`)) {
        tasks.push({
          buildId: value.buildId,
          taskId: value.taskId,
          command: value.command,
          startedAt: value.startedAt,
        });
      }
    }
    return tasks;
  }

  getOrCreateQueue(buildId, maxConcurrent) {
    const normalizedMax = Number.isFinite(maxConcurrent) && maxConcurrent > 0
      ? Math.max(1, Math.floor(maxConcurrent))
      : this.defaultMaxConcurrent;

    let queue = this.buildQueues.get(buildId);
    if (!queue) {
      queue = {
        buildId,
        pending: [],
        running: new Set(),
        maxConcurrent: normalizedMax,
        draining: false,
      };
      this.buildQueues.set(buildId, queue);
      return queue;
    }

    queue.maxConcurrent = normalizedMax;
    return queue;
  }

  getQueueState(buildId) {
    const queue = this.buildQueues.get(buildId);
    if (!queue) return null;
    return {
      buildId: queue.buildId,
      maxConcurrent: queue.maxConcurrent,
      pending: queue.pending.map(item => ({
        taskId: item.taskId,
        title: item.title || '',
      })),
      runningTaskIds: [...queue.running],
      pendingCount: queue.pending.length,
      runningCount: queue.running.size,
      active: queue.pending.length > 0 || queue.running.size > 0,
    };
  }

  async startBuildQueue({ buildId, entries, maxConcurrent }) {
    if (!Array.isArray(entries)) {
      throw new Error('entries must be an array');
    }

    const queue = this.getOrCreateQueue(buildId, maxConcurrent);
    const pendingIds = new Set(queue.pending.map(item => item.taskId));
    let enqueuedCount = 0;

    for (const entry of entries) {
      const taskId = entry?.taskId;
      if (!taskId) continue;
      if (pendingIds.has(taskId)) continue;
      if (queue.running.has(taskId)) continue;
      if (this.isRunning(buildId, taskId)) continue;

      queue.pending.push({
        ...entry,
        taskId,
      });
      pendingIds.add(taskId);
      enqueuedCount += 1;
    }

    if (enqueuedCount > 0) {
      this.eventBus.broadcast(buildId, 'execution-log', {
        buildId,
        taskId: null,
        stream: 'system',
        message: `Queued ${enqueuedCount} task(s) for execution (max ${queue.maxConcurrent} concurrent).`,
        timestamp: new Date().toISOString(),
      });
    }

    void this.drainBuildQueue(buildId);

    return {
      enqueuedCount,
      queue: this.getQueueState(buildId),
    };
  }

  async drainBuildQueue(buildId) {
    const queue = this.buildQueues.get(buildId);
    if (!queue || queue.draining) return;
    queue.draining = true;

    try {
      while (queue.running.size < queue.maxConcurrent && queue.pending.length > 0) {
        const next = queue.pending.shift();
        if (!next || !next.taskId) continue;

        if (queue.running.has(next.taskId) || this.isRunning(buildId, next.taskId)) {
          continue;
        }

        queue.running.add(next.taskId);

        try {
          await this.start({
            buildId,
            taskId: next.taskId,
            command: next.command,
            cwd: next.cwd,
            handoffPrompt: next.handoffPrompt,
            isStreamJson: next.isStreamJson,
            runnerName: next.runnerName,
          });
        } catch (err) {
          queue.running.delete(next.taskId);
          const blockedReason = err?.message || 'Failed to start task';

          if (/already running/i.test(blockedReason)) {
            continue;
          }

          this.eventBus.broadcast(buildId, 'execution-log', {
            buildId,
            taskId: next.taskId,
            stream: 'error',
            message: `Failed to start ${next.taskId}: ${blockedReason}`,
            timestamp: new Date().toISOString(),
          });

          try {
            await this.complete(buildId, next.taskId, 'blocked', { blockedReason });
          } catch (completeErr) {
            console.warn(`Failed to mark ${next.taskId} as blocked:`, completeErr.message);
          }
        }
      }
    } finally {
      queue.draining = false;
      if (queue.pending.length === 0 && queue.running.size === 0) {
        this.buildQueues.delete(buildId);
      }
    }
  }

  onTaskSettled(buildId, taskId) {
    const queue = this.buildQueues.get(buildId);
    if (!queue) return;

    queue.running.delete(taskId);
    queue.pending = queue.pending.filter(item => item.taskId !== taskId);

    if (queue.pending.length === 0 && queue.running.size === 0) {
      this.buildQueues.delete(buildId);
      return;
    }

    void this.drainBuildQueue(buildId);
  }

  async start({ buildId, taskId, command, cwd, handoffPrompt, isStreamJson, runnerName }) {
    if (this.isRunning(buildId, taskId)) {
      throw new Error(`Task ${taskId} is already running`);
    }

    await updateTask(buildId, taskId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      blockedReason: '',
    });

    this.eventBus.broadcast(buildId, 'task-status-changed', {
      buildId,
      taskId,
      status: 'in_progress',
      timestamp: new Date().toISOString(),
    });

    this.eventBus.broadcast(buildId, 'execution-log', {
      buildId,
      taskId,
      stream: 'system',
      message: `Task ${taskId} started`,
      timestamp: new Date().toISOString(),
    });

    if (!command) {
      return this.startHandoff({ buildId, taskId });
    }

    return this.startCommandRun({ buildId, taskId, command, cwd, handoffPrompt, isStreamJson, runnerName });
  }

  async complete(buildId, taskId, status, extra = {}) {
    const payload = {
      status,
      completedAt: new Date().toISOString(),
      ...extra,
    };

    await updateTask(buildId, taskId, payload);

    this.eventBus.broadcast(buildId, 'task-status-changed', {
      buildId,
      taskId,
      status,
      timestamp: payload.completedAt,
      ...extra,
    });

    this.onTaskSettled(buildId, taskId);

    // Log completion/failure to Live Output
    if (status === 'review') {
      this.eventBus.broadcast(buildId, 'execution-log', {
        buildId,
        taskId,
        stream: 'success',
        message: `Task ${taskId} completed successfully.`,
        timestamp: payload.completedAt,
      });
    } else if (status === 'blocked') {
      this.eventBus.broadcast(buildId, 'execution-log', {
        buildId,
        taskId,
        stream: 'error',
        message: `Task ${taskId} failed${extra.blockedReason ? `: ${extra.blockedReason}` : '.'}`,
        timestamp: payload.completedAt,
      });
    }

    // Check if all tasks in this build are now complete → auto-move build to review
    await this.checkBuildCompletion(buildId);
  }

  async checkBuildCompletion(buildId) {
    try {
      const meta = await readBuildMeta(buildId);
      if (!meta || meta.status !== 'in_progress') return;

      const parsed = await getTasks(buildId);
      const tasks = parsed.tasks || [];
      if (tasks.length === 0) return;

      // A task is "done" if it's in review or deployed (completed states)
      const doneStatuses = new Set(['review', 'deployed', 'blocked']);
      const allDone = tasks.every(t => doneStatuses.has(t.status));
      // Also check nothing is still running
      const anyRunning = tasks.some(t => t.status === 'in_progress');

      if (allDone && !anyRunning) {
        await updateBuildStatus(buildId, 'review');

        this.eventBus.broadcast(buildId, 'execution-log', {
          buildId,
          taskId: null,
          stream: 'success',
          message: 'All tasks complete — cycle moved to Review.',
          timestamp: new Date().toISOString(),
        });

        this.eventBus.broadcast(buildId, 'build-status-changed', {
          buildId,
          status: 'review',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Don't fail the task completion if build check fails
      console.warn(`checkBuildCompletion failed for ${buildId}:`, err.message);
    }
  }

  startWatcher(buildId, taskId, cwd) {
    const root = cwd || process.env.VIBE_PROJECT_PATH || process.cwd();

    const watcher = chokidar.watch(root, {
      ignored: [
        /(^|[/\\])\../,
        /node_modules/,
        /\.git/,
      ],
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100,
      },
    });

    watcher.on('change', changedPath => {
      const relative = path.relative(root, changedPath);
      this.eventBus.broadcast(buildId, 'file-changed', {
        buildId,
        taskId,
        file: relative,
        timestamp: new Date().toISOString(),
      });
    });

    return watcher;
  }

  startHandoff({ buildId, taskId }) {
    const key = this.key(buildId, taskId);
    const startedAt = new Date().toISOString();

    this.eventBus.broadcast(buildId, 'execution-log', {
      buildId,
      taskId,
      message: `No runner configured for ${taskId} — marking as blocked. Configure a runner in Settings → CLI Runners.`,
      stream: 'warning',
      timestamp: startedAt,
    });

    // Auto-complete as blocked after a brief delay so the status update settles
    this.running.set(key, {
      type: 'handoff',
      buildId,
      taskId,
      command: '[no runner]',
      startedAt,
      stop: async () => { return; },
    });

    // Immediately mark as blocked — don't leave tasks hanging forever
    setTimeout(async () => {
      this.running.delete(key);
      try {
        await this.complete(buildId, taskId, 'blocked', {
          blockedReason: 'No runner configured. Set up a CLI runner in Settings.',
        });
      } catch (err) {
        console.warn(`Failed to auto-block handoff task ${taskId}:`, err.message);
      }
    }, 500);

    return {
      buildId,
      taskId,
      startedAt,
      command: '[no runner]',
      mode: 'manual',
    };
  }

  async startCommandRun({ buildId, taskId, command, cwd, handoffPrompt, isStreamJson, runnerName }) {
    const key = this.key(buildId, taskId);
    const startedAt = new Date().toISOString();
    let execCwd = cwd || process.env.VIBE_PROJECT_PATH || process.cwd();

    // ── Git Worktree Isolation ──────────────────────────────────────────────
    try {
      const buildMeta = await readBuildMeta(buildId);
      const projectRoot = buildMeta?.projectRoot || resolveProjectRoot();

      if (buildMeta?.gitEnabled && gitService.isGitRepo(projectRoot)) {
        const worktreePath = path.join(projectRoot, '.vibe', 'worktrees', buildId, taskId);
        const taskBranch = `vibe/${buildId}-${taskId}`;
        const buildBranch = buildMeta.branchName || `vibe/${buildId}`;

        gitService.createWorktree(projectRoot, worktreePath, taskBranch, buildBranch);
        execCwd = worktreePath;

        this.eventBus.broadcast(buildId, 'execution-log', {
          buildId,
          taskId,
          stream: 'system',
          message: `Worktree: .vibe/worktrees/${buildId}/${taskId}/`,
          timestamp: new Date().toISOString(),
        });

        await updateTaskMeta(buildId, taskId, { worktreePath, branchName: taskBranch });
      }
    } catch (gitErr) {
      this.eventBus.broadcast(buildId, 'execution-log', {
        buildId,
        taskId,
        stream: 'warning',
        message: `Worktree setup failed, using project root: ${gitErr.message}`,
        timestamp: new Date().toISOString(),
      });
      // Fall through with original execCwd
    }
    // ───────────────────────────────────────────────────────────────────────

    // Write the prompt to a temp file and pipe it via stdin to the runner.
    // This avoids all shell escaping issues (backticks, $, quotes, newlines).
    let promptFile = null;
    let shellCmd = command;

    if (handoffPrompt) {
      const uid = crypto.randomBytes(4).toString('hex');
      promptFile = path.join(os.tmpdir(), `vibe-task-${buildId}-${taskId}-${uid}.txt`);
      await fs.writeFile(promptFile, handoffPrompt, 'utf8');
      shellCmd = `cat ${JSON.stringify(promptFile)} | ${command}`;
    }

    const child = spawn('sh', ['-lc', shellCmd], {
      cwd: execCwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const watcher = this.startWatcher(buildId, taskId, execCwd);

    const pushLog = (message, stream = 'stdout') => {
      this.eventBus.broadcast(buildId, 'execution-log', {
        buildId,
        taskId,
        message,
        stream,
        timestamp: new Date().toISOString(),
      });

      const guardMatch = message.match(/guard\s+([A-Za-z0-9_-]+)\s*:\s*(pass|fail)/i);
      if (guardMatch) {
        this.eventBus.broadcast(buildId, 'guard-result', {
          buildId,
          taskId,
          guardId: guardMatch[1],
          status: guardMatch[2].toLowerCase(),
          details: message,
          timestamp: new Date().toISOString(),
        });
      }
    };

    const stream = createStreamProcessor({
      runnerName: runnerName || '',
      isStreamJson: isStreamJson || false,
      onText: (delta) => pushLog(delta, 'stdout'),
      onError: (msg) => pushLog(msg, 'error'),
    });

    child.stdout.on('data', chunk => {
      stream.processChunk(chunk);
    });

    child.stderr.on('data', chunk => {
      pushLog(String(chunk), 'stderr');
    });

    child.on('exit', async code => {
      stream.flush();
      const fullStdout = stream.getFullOutput();
      await watcher.close();
      this.running.delete(key);

      // Cleanup temp file
      if (promptFile) {
        fs.unlink(promptFile).catch(() => {});
      }

      // Analyze output: if runner asked for permission or reported inability,
      // treat as blocked even if exit code is 0
      const askedPermission = /permission|could you (grant|approve|allow)|i need (write )?access|unable to (write|create|modify)/i.test(fullStdout);

      let status;
      let extra = {};

      if (code !== 0) {
        status = 'blocked';
        extra = { blockedReason: `Command exited with code ${code}` };
      } else if (askedPermission) {
        status = 'blocked';
        extra = { blockedReason: 'Runner requested permission it could not obtain. Review output and re-run.' };
      } else {
        status = 'review';
      }

      // Detect questions in task output and notify the UI
      const questions = extractQuestions(fullStdout);
      if (questions.length > 0) {
        this.eventBus.broadcast(buildId, 'runner-questions', {
          buildId,
          taskId,
          phase: 'execution',
          questions,
          timestamp: new Date().toISOString(),
        });
      }

      await this.complete(buildId, taskId, status, extra);
    });

    this.running.set(key, {
      type: 'command',
      buildId,
      taskId,
      command: shellCmd,
      startedAt,
      child,
      stop: async () => {
        child.kill('SIGTERM');
        await watcher.close();
        if (promptFile) {
          fs.unlink(promptFile).catch(() => {});
        }
      },
    });

    return {
      buildId,
      taskId,
      startedAt,
      command: shellCmd,
      mode: 'command',
    };
  }

  async cancel(buildId, taskId) {
    const key = this.key(buildId, taskId);
    const run = this.running.get(key);

    if (!run) {
      return false;
    }

    await run.stop();
    this.running.delete(key);

    await this.complete(buildId, taskId, 'blocked', {
      blockedReason: 'Execution cancelled by user',
    });

    this.eventBus.broadcast(buildId, 'execution-log', {
      buildId,
      taskId,
      stream: 'system',
      message: 'Execution cancelled by user',
      timestamp: new Date().toISOString(),
    });

    return true;
  }
}

module.exports = ExecutionEngine;
