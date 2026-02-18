'use strict';

const express = require('express');
const { readBuildMeta, writeBuildMeta, lockAndWriteMeta, resolveProjectRoot } = require('../services/tasks-store');
const gitService = require('../services/git-service');

function createGitRouter() {
  const router = express.Router();

  /**
   * GET /api/git/status
   * Returns gh CLI install + auth status.
   */
  router.get('/status', (req, res) => {
    try {
      const { installed, authenticated } = gitService.checkGhCli();
      return res.json({ ghInstalled: installed, ghAuthenticated: authenticated });
    } catch {
      return res.json({ ghInstalled: false, ghAuthenticated: false });
    }
  });

  /**
   * GET /api/git/builds/:buildId/diff
   * Returns all changed files across all tasks for the build.
   * Response: { gitEnabled, files: [{path, additions, deletions, taskId, branchName}] }
   */
  router.get('/builds/:buildId/diff', async (req, res) => {
    try {
      const { buildId } = req.params;
      const meta = await readBuildMeta(buildId);

      if (!meta?.gitEnabled) {
        return res.json({ gitEnabled: false, files: [] });
      }

      const projectRoot = meta.projectRoot || resolveProjectRoot();
      const baseBranch = meta.branchName; // e.g. vibe/v1
      const taskMeta = meta.taskMeta || {};

      const allFiles = [];

      for (const [taskId, tmeta] of Object.entries(taskMeta)) {
        if (!tmeta?.branchName) continue;
        const changed = gitService.getChangedFiles(projectRoot, baseBranch, tmeta.branchName);
        for (const f of changed) {
          allFiles.push({ ...f, taskId, branchName: tmeta.branchName });
        }
      }

      return res.json({ gitEnabled: true, files: allFiles });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/git/builds/:buildId/diff/:taskId
   * Returns diff for a specific task. Optional ?path= to restrict to one file.
   * Response: { diff: string, files: [{path, additions, deletions}] }
   */
  router.get('/builds/:buildId/diff/:taskId', async (req, res) => {
    try {
      const { buildId, taskId } = req.params;
      const filePath = req.query.path ? String(req.query.path) : null;

      const meta = await readBuildMeta(buildId);
      if (!meta?.gitEnabled) {
        return res.json({ gitEnabled: false, diff: '', files: [] });
      }

      const projectRoot = meta.projectRoot || resolveProjectRoot();
      const baseBranch = meta.branchName;
      const tmeta = meta.taskMeta?.[taskId];

      if (!tmeta?.branchName) {
        return res.json({ gitEnabled: true, diff: '', files: [] });
      }

      const taskBranch = tmeta.branchName;
      const diff = gitService.getDiff(projectRoot, baseBranch, taskBranch, filePath);
      const files = gitService.getChangedFiles(projectRoot, baseBranch, taskBranch);

      return res.json({ gitEnabled: true, diff, files });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/git/builds/:buildId/pr
   * Creates a GitHub PR via gh CLI.
   * Body: { title, body, base? }
   * Response: { url, number }
   */
  router.post('/builds/:buildId/pr', async (req, res) => {
    try {
      const { buildId } = req.params;
      const title = String(req.body?.title || '').trim();
      const body = String(req.body?.body || '').trim();
      const base = String(req.body?.base || 'main').trim();

      if (!title) {
        return res.status(400).json({ error: 'PR title is required' });
      }

      const meta = await readBuildMeta(buildId);
      if (!meta?.gitEnabled || !meta?.branchName) {
        return res.status(400).json({ error: 'Git is not enabled for this build' });
      }

      // Return existing PR instead of creating a duplicate
      if (meta.prUrl) {
        return res.json({ url: meta.prUrl, number: meta.prNumber, existing: true });
      }

      // Check gh CLI availability first
      const ghStatus = gitService.checkGhCli();
      if (!ghStatus.installed) {
        return res.status(400).json({ error: 'gh CLI not found. Install from https://cli.github.com/' });
      }
      if (!ghStatus.authenticated) {
        return res.status(400).json({ error: 'gh CLI not authenticated. Run: gh auth login' });
      }

      const projectRoot = meta.projectRoot || resolveProjectRoot();
      const head = meta.branchName; // PR from the build branch

      const { url, number } = gitService.createPR(projectRoot, head, title, body, base);

      // Persist PR info in BUILD_META (locked to avoid races)
      await lockAndWriteMeta(buildId, (m) => {
        m.prUrl = url;
        m.prNumber = number;
      });

      return res.json({ url, number });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createGitRouter;
