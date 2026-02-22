'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Process Registry
//
// Tracks non-task child processes (chat, planning, feedback) so they can be
// cancelled by the user. Task execution processes are tracked separately in
// ExecutionEngine.running.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs/promises');

/** @type {Map<string, { child: import('child_process').ChildProcess, promptFile: string|null, buildId: string, type: string, startedAt: string }>} */
const processes = new Map();

/**
 * Register a child process for cancellation tracking.
 * @param {string} processId - Unique process ID (e.g. "chat-v2-abc123")
 * @param {object} entry
 * @param {import('child_process').ChildProcess} entry.child - The spawned child process
 * @param {string} entry.buildId - Build ID this process belongs to
 * @param {string} entry.type - Process type: 'chat', 'planning', 'feedback'
 * @param {string|null} [entry.promptFile] - Temp prompt file to clean up on cancel
 */
function register(processId, { child, buildId, type, promptFile = null }) {
  processes.set(processId, {
    child,
    buildId,
    type,
    promptFile,
    startedAt: new Date().toISOString(),
  });

  // Auto-deregister when the process exits
  child.on('exit', () => {
    processes.delete(processId);
  });
}

/**
 * Cancel a registered process by killing the child.
 * @param {string} processId - The process ID to cancel
 * @returns {boolean} true if process was found and killed
 */
async function cancel(processId) {
  const entry = processes.get(processId);
  if (!entry) return false;

  try {
    entry.child.kill('SIGTERM');
  } catch {
    // Process may have already exited
  }

  // Clean up temp file
  if (entry.promptFile) {
    await fs.unlink(entry.promptFile).catch(() => {});
  }

  processes.delete(processId);
  return true;
}

/**
 * Cancel all processes for a build.
 * @param {string} buildId - Build ID to cancel all processes for
 * @returns {string[]} List of cancelled process IDs
 */
async function cancelAll(buildId) {
  const cancelled = [];
  for (const [processId, entry] of processes) {
    if (entry.buildId === buildId) {
      await cancel(processId);
      cancelled.push(processId);
    }
  }
  return cancelled;
}

/**
 * Get currently running processes (for status/debugging).
 * @param {string} [buildId] - Optional filter by build ID
 * @returns {Array<{ processId: string, buildId: string, type: string, startedAt: string }>}
 */
function list(buildId) {
  const result = [];
  for (const [processId, entry] of processes) {
    if (!buildId || entry.buildId === buildId) {
      result.push({
        processId,
        buildId: entry.buildId,
        type: entry.type,
        startedAt: entry.startedAt,
      });
    }
  }
  return result;
}

module.exports = { register, cancel, cancelAll, list };
