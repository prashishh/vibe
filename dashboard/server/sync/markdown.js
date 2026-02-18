const path = require('path');
const chokidar = require('chokidar');
const { resolveBuildsRoot, getTasks } = require('../services/tasks-store');

function extractBuildId(filePath, buildsRoot) {
  const relative = path.relative(buildsRoot, filePath);
  const [buildId] = relative.split(path.sep);
  if (/^v\d+$/.test(buildId)) {
    return buildId;
  }
  return null;
}

function setupMarkdownSync(eventBus) {
  const buildsRoot = resolveBuildsRoot();
  const pattern = path.join(buildsRoot, 'v*/TASKS.md');

  const watcher = chokidar.watch(pattern, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  const emitTasksUpdated = async filePath => {
    const buildId = extractBuildId(filePath, buildsRoot);
    if (!buildId) return;

    try {
      const parsed = await getTasks(buildId);
      eventBus.broadcast(buildId, 'tasks-updated', {
        buildId,
        tasks: parsed.tasks,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore transient parse/read errors while file is being updated.
    }
  };

  watcher.on('change', emitTasksUpdated);
  watcher.on('add', emitTasksUpdated);

  return watcher;
}

module.exports = {
  setupMarkdownSync,
};
