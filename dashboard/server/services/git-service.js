'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function q(value) {
  return JSON.stringify(String(value));
}

function exec(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: 'pipe',
    maxBuffer: 10 * 1024 * 1024, // 10 MB
    ...opts,
  }).toString().trim();
}

// ─────────────────────────────────────────────
// Core git functions
// ─────────────────────────────────────────────

/**
 * Returns true if the given directory is inside a git repository.
 */
function isGitRepo(projectRoot) {
  try {
    exec(`git -C ${q(projectRoot)} rev-parse --is-inside-work-tree`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Appends `entry` to .gitignore if it is not already present.
 */
function ensureGitignoreEntry(projectRoot, entry) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';
  try {
    content = fs.readFileSync(gitignorePath, 'utf8');
  } catch {
    // file doesn't exist — will be created
  }

  const lines = content.split('\n').map(l => l.trim());
  if (lines.includes(entry.trim())) return; // already there

  const newContent = content.endsWith('\n') || content === ''
    ? `${content}${entry}\n`
    : `${content}\n${entry}\n`;

  fs.writeFileSync(gitignorePath, newContent, 'utf8');
}

/**
 * Creates the build-level branch `vibe/{buildId}` from the current HEAD.
 * Does NOT checkout — avoids disrupting the user's working tree.
 * The branch is used as a base ref for task worktrees and diffs.
 * No-op if the branch already exists.
 */
function createBuildBranch(projectRoot, branchName) {
  const exists = spawnSync('git', ['-C', projectRoot, 'show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
  if (exists.status === 0) return; // branch already exists

  exec(`git -C ${q(projectRoot)} branch ${q(branchName)}`);
}

/**
 * Creates a git worktree at `worktreePath` on branch `branch`.
 * The task branch is created from `fromBranch` (the build branch) if it doesn't yet exist.
 * No-op if the worktree directory already exists.
 */
function createWorktree(projectRoot, worktreePath, branch, fromBranch) {
  if (fs.existsSync(worktreePath)) return; // already set up

  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

  const cwd = q(projectRoot);
  const bn = q(branch);
  const wp = q(worktreePath);

  // Create task branch from the build branch (not HEAD) if it doesn't exist
  const branchExists = spawnSync('git', ['-C', projectRoot, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
  if (branchExists.status !== 0) {
    const startPoint = fromBranch ? q(fromBranch) : '';
    exec(`git -C ${cwd} branch ${bn} ${startPoint}`.trim());
  }

  exec(`git -C ${cwd} worktree add ${wp} ${bn}`);
}

/**
 * Removes a git worktree and prunes the worktree list.
 * Safe to call even if the worktree doesn't exist.
 */
function removeWorktree(projectRoot, worktreePath) {
  try {
    exec(`git -C ${q(projectRoot)} worktree remove --force ${q(worktreePath)}`);
  } catch {
    // worktree may already be gone — try prune regardless
  }
  try {
    exec(`git -C ${q(projectRoot)} worktree prune`);
  } catch {
    // ignore
  }
}

/**
 * Deletes a local git branch. Safe to call if branch doesn't exist.
 */
function deleteBranch(projectRoot, branchName) {
  try {
    exec(`git -C ${q(projectRoot)} branch -D ${q(branchName)}`);
  } catch {
    // branch may not exist — ignore
  }
}

/**
 * Returns a list of changed files between `base` and `head` branches.
 * Result: [{path, additions, deletions}]
 */
function getChangedFiles(projectRoot, base, head) {
  try {
    const output = exec(
      `git -C ${q(projectRoot)} diff --numstat ${q(base)}...${q(head)}`
    );
    if (!output) return [];

    return output.split('\n').filter(Boolean).map(line => {
      const parts = line.split('\t');
      if (parts.length < 3) return null;
      const [additions, deletions, filePath] = parts;
      return {
        path: filePath,
        additions: additions === '-' ? 0 : Number(additions),
        deletions: deletions === '-' ? 0 : Number(deletions),
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Returns the unified diff between `base` and `head` branches.
 * If `filePath` is provided, restricts to that file only.
 * Returns '' on error.
 */
function getDiff(projectRoot, base, head, filePath) {
  try {
    const fileArg = filePath ? ` -- ${q(filePath)}` : '';
    return exec(
      `git -C ${q(projectRoot)} diff ${q(base)}...${q(head)}${fileArg}`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
  } catch {
    return '';
  }
}

/**
 * Creates a GitHub PR via `gh` CLI.
 * Returns {url, number} or throws.
 */
function createPR(projectRoot, head, title, body, base = 'main') {
  const result = spawnSync(
    'gh',
    ['pr', 'create', '--head', head, '--base', base, '--title', title, '--body', body],
    { cwd: projectRoot, encoding: 'utf8' }
  );

  if (result.status !== 0) {
    const errText = (result.stderr || '').trim();
    throw new Error(errText || 'gh pr create failed');
  }

  const stdout = (result.stdout || '').trim();
  // PR URL is typically the last line of stdout
  const lines = stdout.split('\n').filter(Boolean);
  const url = lines.find(l => l.startsWith('https://')) || lines[lines.length - 1] || '';

  // Parse PR number from URL: .../pull/123
  const numMatch = url.match(/\/pull\/(\d+)/);
  const number = numMatch ? Number(numMatch[1]) : null;

  return { url, number };
}

/**
 * Checks whether `gh` CLI is installed and authenticated.
 * Never throws.
 */
function checkGhCli() {
  const which = spawnSync('gh', ['--version'], { stdio: 'pipe' });
  if (which.status === null || which.status !== 0) {
    return { installed: false, authenticated: false };
  }

  const auth = spawnSync('gh', ['auth', 'status'], { stdio: 'pipe' });
  return {
    installed: true,
    authenticated: auth.status === 0,
  };
}

module.exports = {
  isGitRepo,
  ensureGitignoreEntry,
  createBuildBranch,
  createWorktree,
  removeWorktree,
  deleteBranch,
  getChangedFiles,
  getDiff,
  createPR,
  checkGhCli,
};
