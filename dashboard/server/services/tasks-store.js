const fs = require('fs/promises');
const path = require('path');
const lockfile = require('proper-lockfile');

const DEFAULT_STATUS_KEY = 'Status key: `pending`, `planning`, `in_progress`, `review`, `deployed`, `blocked`';

function resolveBuildsRoot() {
  if (process.env.VIBE_BUILDS_PATH) {
    return path.resolve(process.env.VIBE_BUILDS_PATH);
  }
  return path.resolve(process.cwd(), '.vibe/builds');
}

function resolveProjectRoot() {
  if (process.env.VIBE_PROJECT_PATH) {
    return path.resolve(process.env.VIBE_PROJECT_PATH);
  }
  return process.cwd();
}

function sanitizeBuildId(buildId) {
  if (!/^v\d+$/.test(buildId)) {
    throw new Error(`Invalid build id: ${buildId}`);
  }
  return buildId;
}

function buildDirPath(buildId) {
  const id = sanitizeBuildId(buildId);
  return path.join(resolveBuildsRoot(), id);
}

function tasksFilePath(buildId) {
  return path.join(buildDirPath(buildId), 'TASKS.md');
}

function planFilePath(buildId) {
  return path.join(buildDirPath(buildId), 'PLAN.md');
}

async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function trimTrailingBlanks(value) {
  return value.replace(/\s+$/g, '');
}

function normalizeStatus(status) {
  const allowed = new Set(['pending', 'planning', 'in_progress', 'review', 'deployed', 'blocked']);
  const value = String(status || '').trim().toLowerCase();
  if (value === 'done') return 'pending';
  return allowed.has(value) ? value : 'pending';
}

function normalizeRisk(risk) {
  const value = String(risk || '').trim();
  return value || 'Medium';
}

function toTaskId(n) {
  return `T-${String(n).padStart(2, '0')}`;
}

function normalizeBuildType(buildType) {
  const value = String(buildType || '').trim().toLowerCase();
  if (value === 'full' || value === 'lite' || value === 'vibe' || value === 'custom') {
    return value;
  }
  return 'lite';
}

function toTitleCase(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function summarizeText(input, fallback = 'New Build') {
  const cleaned = String(input || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned;
}

function firstTaskTitle(description) {
  const summary = summarizeText(description, 'Define initial task');
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

function buildGoalMarkdown({ buildId, buildType, customType, description }) {
  const title = summarizeText(description, 'New Feature');
  const label = buildType === 'custom'
    ? `${toTitleCase(customType || 'Custom')} Build`
    : `${toTitleCase(buildType)} Build`;

  return [
    `# Build ${buildId}: ${title}`,
    '',
    `Type: ${label}`,
    '',
    '## Intent',
    description || '[Describe what should be built and why it matters]',
    '',
    '## Success Metric',
    '- [Define concrete outcomes for this build]',
    '',
    '## Scope',
    '### In',
    '- [Primary deliverables]',
    '',
    '### Out',
    '- [Explicitly out-of-scope items]',
    '',
    '## Guard Impact',
    '- G-XX: [Guard name] — YES/NO (reason)',
    '',
  ].join('\n');
}

function buildLiteTasksMarkdown(buildId, description) {
  const title = firstTaskTitle(description);

  return [
    `# Build ${buildId} Tasks`,
    '',
    DEFAULT_STATUS_KEY,
    '',
    '## Task List',
    '',
    `### T-01: ${title}`,
    '- **Outcome**: Deliver the requested feature increment',
    '- **Risk**: Medium',
    '- **Status**: pending',
    '- **Acceptance**:',
    '  - [ ] Implementation completed',
    '  - [ ] Tests/verification updated',
    '- **Files**:',
    '',
    '## Notes',
    '- Add additional tasks as needed.',
    '- If risk grows to High/Critical, promote to full build.',
    '',
  ].join('\n');
}

function buildFullTasksMarkdown(buildId, description) {
  const title = firstTaskTitle(description);
  return [
    `# Iteration ${buildId} Tasks Tracker`,
    '',
    DEFAULT_STATUS_KEY,
    '',
    '| Task | Title | Risk | Status |',
    '|------|-------|------|--------|',
    `| T-01 | ${title} | Medium | pending |`,
    '',
    '## Notes',
    '- Detailed acceptance and rollback criteria are defined in `PLAN.md`.',
    '',
  ].join('\n');
}

function buildPlanMarkdown(buildId, description) {
  const title = firstTaskTitle(description);
  return [
    `# Build ${buildId} Plan`,
    '',
    '## Task List',
    '',
    `### T-01: ${title}`,
    '- Outcome: Deliver the requested scope with clear validation.',
    '- Risk: Medium',
    '- Acceptance:',
    '  - [ ] Core implementation completed.',
    '  - [ ] Test coverage or checks updated.',
    '  - [ ] Documentation updated if behavior changes.',
    '- Rollback: Revert modified files and restore prior behavior.',
    '- Guards touched: G-XX',
    '- Files (expected):',
    '',
    '## Execution Notes',
    '- Split this task if implementation scope grows.',
    '',
  ].join('\n');
}

function buildSimpleDoc(title, bodyLines = []) {
  return [
    `# ${title}`,
    '',
    ...bodyLines,
    '',
  ].join('\n');
}

function suggestBuildType(description) {
  const text = String(description || '').toLowerCase();
  if (/(architecture|redesign|migration|security|critical|infra|database)/.test(text)) {
    return 'full';
  }
  return 'lite';
}

function buildClarificationQuestions(description, buildType) {
  const questions = [];
  const text = String(description || '').trim();

  if (text.length < 25) {
    questions.push('What is the exact user-facing outcome you want?');
  }

  if (!/(test|guard|verify|validation|acceptance)/i.test(text)) {
    questions.push('How should we verify this is done (tests or guard checks)?');
  }

  if (buildType === 'full' && !/(risk|rollback|migration|deploy)/i.test(text)) {
    questions.push('Any high-risk areas or rollback constraints to capture up front?');
  }

  return questions;
}

function nextTaskId(tasks) {
  let max = 0;
  for (const task of tasks) {
    const match = String(task.id || '').match(/^T-(\d+)$/);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return toTaskId(max + 1);
}

function parseCsvField(value) {
  return String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function parsePlanDetails(planContent) {
  const byId = new Map();
  if (!planContent) {
    return byId;
  }

  const taskHeader = /^###\s+(T-\d+):\s*(.+)$/gm;
  const matches = Array.from(planContent.matchAll(taskHeader));

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current[0].length;
    const end = next ? next.index : planContent.length;
    const block = planContent.slice(start, end);

    const task = {
      id: current[1],
      title: current[2].trim(),
      outcome: '',
      risk: 'Medium',
      guardrails: [],
      files: [],
      acceptance: [],
    };

    const outcomeMatch = block.match(/^-\s*Outcome:\s*(.+)$/m);
    if (outcomeMatch) task.outcome = outcomeMatch[1].trim();

    const riskMatch = block.match(/^-\s*Risk:\s*(.+)$/m);
    if (riskMatch) task.risk = riskMatch[1].trim();

    const guardsMatch = block.match(/^-\s*(?:Guards|Guardrails)\s*touched:\s*(.+)$/mi);
    if (guardsMatch) task.guardrails = parseCsvField(guardsMatch[1]);

    const filesMatch = block.match(/^-\s*Files\s*\(expected\):\s*(.+)$/mi);
    if (filesMatch) {
      task.files = parseCsvField(filesMatch[1].replace(/`/g, ''));
    }

    const acceptanceMatch = block.match(/^-\s*Acceptance:\s*([\s\S]*?)(?=^\s*-\s*(?:Rollback|Guards?|Guardrails|Files|Status|Outcome|Risk):|\n###\s+T-|\n##\s+|$)/m);
    if (acceptanceMatch) {
      const lines = acceptanceMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const checkbox = line.match(/^-\s*\[[ xX]\]\s*(.+)$/);
          if (checkbox) return checkbox[1].trim();
          const bullet = line.match(/^-\s*(.+)$/);
          if (bullet) return bullet[1].trim();
          return '';
        })
        .filter(Boolean);
      task.acceptance = lines;
    }

    byId.set(task.id, task);
  }

  return byId;
}

function parseTableTasks(tasksContent) {
  const lines = tasksContent.split('\n');
  const heading = (tasksContent.match(/^#\s+.+$/m) || ['# Tasks'])[0];
  const statusLine = (tasksContent.match(/^Status key:.+$/m) || [DEFAULT_STATUS_KEY])[0];

  const tableHeaderIndex = lines.findIndex(line => /^\|\s*Task\s*\|/i.test(line));
  if (tableHeaderIndex === -1) {
    return null;
  }

  let rowStart = tableHeaderIndex + 1;
  if (lines[rowStart] && /^\|\s*[-:\s|]+\|\s*$/.test(lines[rowStart])) {
    rowStart += 1;
  }

  const tasks = [];
  let cursor = rowStart;
  while (cursor < lines.length && lines[cursor].trim().startsWith('|')) {
    const cells = lines[cursor]
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim());

    if (cells.length >= 4) {
      const [id, title, risk, status] = cells;
      if (/^T-\d+$/i.test(id)) {
        tasks.push({
          id,
          title,
          risk: normalizeRisk(risk),
          status: normalizeStatus(status),
          outcome: '',
          acceptance: [],
          files: [],
          guardrails: [],
        });
      }
    }

    cursor += 1;
  }

  const notesIndex = lines.findIndex((line, idx) => idx >= cursor && /^##\s+Notes\b/i.test(line));
  const notes = notesIndex >= 0 ? trimTrailingBlanks(lines.slice(notesIndex).join('\n')) : '';

  return {
    format: 'table',
    heading,
    statusLine,
    notes,
    tasks,
  };
}

function parseInlineTasks(tasksContent) {
  const heading = (tasksContent.match(/^#\s+.+$/m) || ['# Tasks'])[0];
  const statusLine = (tasksContent.match(/^Status key:.+$/m) || [DEFAULT_STATUS_KEY])[0];

  const notesMatch = tasksContent.match(/(^##\s+Notes\b[\s\S]*)$/m);
  const notes = notesMatch ? trimTrailingBlanks(notesMatch[1]) : '';

  const sections = tasksContent.split(/(?=^###\s*T-\d+\s*:)/m);
  const tasks = [];

  for (const section of sections) {
    const headerMatch = section.match(/^###\s*(T-\d+)\s*:\s*(.+)$/m);
    if (!headerMatch) {
      continue;
    }

    const id = headerMatch[1];
    const title = headerMatch[2].trim();

    const outcome = (section.match(/^-\s*\*\*Outcome\*\*:\s*(.+)$/mi) || [null, ''])[1].trim();
    const risk = normalizeRisk((section.match(/^-\s*\*\*Risk\*\*:\s*(.+)$/mi) || [null, 'Medium'])[1]);
    const status = normalizeStatus((section.match(/^-\s*\*\*Status\*\*:\s*(.+)$/mi) || [null, 'pending'])[1]);

    const filesRaw = (section.match(/^-\s*\*\*Files\*\*:\s*(.+)$/mi) || [null, ''])[1];
    const guardrailsRaw = (section.match(/^-\s*\*\*(?:Guards|Guardrails)\*\*:\s*(.+)$/mi) || [null, ''])[1];

    const acceptance = [];
    const acceptanceBlock = section.match(/^-\s*\*\*Acceptance\*\*:\s*([\s\S]*?)(?=^\s*-\s*\*\*(?:Outcome|Risk|Status|Files|Guards|Guardrails)\*\*|\n###\s+T-|\n##\s+|$)/mi);
    if (acceptanceBlock) {
      for (const line of acceptanceBlock[1].split('\n')) {
        const itemMatch = line.trim().match(/^-\s*\[[ xX]\]\s*(.+)$/);
        if (itemMatch) {
          acceptance.push(itemMatch[1].trim());
        }
      }
    }

    tasks.push({
      id,
      title,
      risk,
      status,
      outcome,
      acceptance,
      files: parseCsvField(filesRaw),
      guardrails: parseCsvField(guardrailsRaw),
    });
  }

  return {
    format: 'inline',
    heading,
    statusLine,
    notes,
    tasks,
  };
}

function parseTasksFile(tasksContent, planContent) {
  const parsed = parseTableTasks(tasksContent) || parseInlineTasks(tasksContent);
  const planDetails = parsePlanDetails(planContent);

  for (const task of parsed.tasks) {
    const detail = planDetails.get(task.id);
    if (!detail) continue;

    if (!task.outcome) task.outcome = detail.outcome;
    if (!task.files.length) task.files = detail.files;
    if (!task.guardrails.length) task.guardrails = detail.guardrails;
    if (!task.acceptance.length) task.acceptance = detail.acceptance;
    if (!task.risk || task.risk === 'Medium') task.risk = detail.risk;
  }

  return parsed;
}

function serializeTable({ heading, statusLine, notes, tasks }) {
  const rows = tasks.map(task => {
    return `| ${task.id} | ${task.title} | ${normalizeRisk(task.risk)} | ${normalizeStatus(task.status)} |`;
  });

  const parts = [
    heading || '# Tasks',
    '',
    statusLine || DEFAULT_STATUS_KEY,
    '',
    '| Task | Title | Risk | Status |',
    '|------|-------|------|--------|',
    ...rows,
  ];

  if (notes) {
    parts.push('', trimTrailingBlanks(notes));
  }

  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function serializeInline({ heading, statusLine, notes, tasks }) {
  const blocks = tasks.map(task => {
    const acceptanceLines = task.acceptance.length
      ? task.acceptance.map(item => `  - [ ] ${item}`)
      : ['  - [ ] Define acceptance criteria'];

    const lines = [
      `### ${task.id}: ${task.title}`,
      `- **Outcome**: ${task.outcome || 'Define the expected outcome'}`,
      `- **Risk**: ${normalizeRisk(task.risk)}`,
      `- **Status**: ${normalizeStatus(task.status)}`,
      '- **Acceptance**:',
      ...acceptanceLines,
    ];

    if (task.files && task.files.length) {
      lines.push(`- **Files**: ${task.files.join(', ')}`);
    } else {
      lines.push('- **Files**:');
    }

    if (task.guardrails && task.guardrails.length) {
      lines.push(`- **Guardrails**: ${task.guardrails.join(', ')}`);
    }

    return lines.join('\n');
  });

  const parts = [
    heading || '# Tasks',
    '',
    statusLine || DEFAULT_STATUS_KEY,
    '',
    '## Task List',
    '',
    blocks.join('\n\n'),
  ];

  if (notes) {
    parts.push('', trimTrailingBlanks(notes));
  }

  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function serializeTasksFile(parsed) {
  if (parsed.format === 'table') {
    return serializeTable(parsed);
  }
  return serializeInline(parsed);
}

async function lockAndWrite(filePath, writer) {
  const release = await lockfile.lock(filePath, {
    retries: {
      retries: 8,
      minTimeout: 50,
      maxTimeout: 500,
    },
    realpath: false,
  });

  try {
    await writer();
  } finally {
    await release();
  }
}

async function loadBuildTasks(buildId) {
  const tasksPath = tasksFilePath(buildId);
  const planPath = planFilePath(buildId);

  const [tasksContent, planContent] = await Promise.all([
    readFileSafe(tasksPath),
    readFileSafe(planPath),
  ]);

  if (!tasksContent) {
    throw new Error(`TASKS.md not found for ${buildId}`);
  }

  return {
    parsed: parseTasksFile(tasksContent, planContent),
    tasksPath,
  };
}

async function saveBuildTasks(buildId, parsed) {
  const filePath = tasksFilePath(buildId);
  await lockAndWrite(filePath, async () => {
    const content = serializeTasksFile(parsed);
    await fs.writeFile(filePath, content, 'utf8');
  });
}

function sanitizeTaskInput(task) {
  const cleaned = {
    id: task.id,
    title: String(task.title || '').trim(),
    risk: normalizeRisk(task.risk),
    status: normalizeStatus(task.status),
    outcome: String(task.outcome || '').trim(),
    acceptance: Array.isArray(task.acceptance)
      ? task.acceptance.map(item => String(item).trim()).filter(Boolean)
      : [],
    files: Array.isArray(task.files)
      ? task.files.map(item => String(item).trim()).filter(Boolean)
      : [],
    guardrails: Array.isArray(task.guardrails)
      ? task.guardrails.map(item => String(item).trim()).filter(Boolean)
      : [],
    assignedLLM: task.assignedLLM ? String(task.assignedLLM).trim() : '',
    executionLogs: Array.isArray(task.executionLogs)
      ? task.executionLogs.map(item => String(item))
      : [],
    startedAt: task.startedAt ? String(task.startedAt) : '',
    completedAt: task.completedAt ? String(task.completedAt) : '',
    blockedReason: task.blockedReason ? String(task.blockedReason).trim() : '',
  };

  if (!cleaned.title) {
    throw new Error('Task title is required');
  }

  return cleaned;
}

function metaFilePath(buildId) {
  return path.join(buildDirPath(buildId), 'BUILD_META.json');
}

async function readBuildMeta(buildId) {
  try {
    const raw = await fs.readFile(metaFilePath(buildId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeBuildMeta(buildId, meta) {
  await fs.writeFile(metaFilePath(buildId), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

/**
 * Atomically read→modify→write BUILD_META.json under a file lock.
 * The updater receives the parsed meta object and mutates it in place.
 */
async function lockAndWriteMeta(buildId, updater) {
  const filePath = metaFilePath(buildId);
  const release = await lockfile.lock(filePath, {
    retries: { retries: 8, minTimeout: 50, maxTimeout: 500 },
    realpath: false,
  });
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const meta = JSON.parse(raw);
    await updater(meta);
    await fs.writeFile(filePath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    return meta;
  } finally {
    await release();
  }
}

const VALID_BUILD_STATUSES = new Set(['pending', 'planning', 'in_progress', 'review', 'deployed', 'blocked']);

// Valid status transitions (from → [allowed targets])
// 'blocked' can come from any state, and can go back to any state
const VALID_TRANSITIONS = {
  pending: ['planning'],
  planning: ['in_progress'],
  in_progress: ['review', 'blocked'],
  review: ['deployed', 'in_progress', 'blocked'],
  deployed: [],
  blocked: ['pending', 'planning', 'in_progress', 'review'],
};

function normalizeBuildStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return VALID_BUILD_STATUSES.has(value) ? value : 'pending';
}

function validateBuildTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot move from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`
    );
  }
}

async function listBuilds() {
  const root = resolveBuildsRoot();
  let entries = [];

  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const builds = entries
    .filter(entry => entry.isDirectory() && /^v\d+$/.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  const results = [];
  for (const buildId of builds) {
    const meta = await readBuildMeta(buildId);
    let totalTasks = 0;
    let doneTasks = 0;
    let inProgressTasks = 0;
    let blockedTasks = 0;
    let pendingTasks = 0;

    // Compute build status first (needed for task sanitization)
    let buildStatus = normalizeBuildStatus(meta?.status);

    try {
      const { parsed } = await loadBuildTasks(buildId);

      // Guard: no task can be 'deployed' while build is still planning/pending
      // (LLM sometimes generates 'done'/'deployed' status incorrectly)
      if (buildStatus === 'planning' || buildStatus === 'pending') {
        for (const task of parsed.tasks) {
          if (task.status === 'deployed') {
            task.status = 'pending';
          }
        }
      }

      totalTasks = parsed.tasks.length;
      doneTasks = parsed.tasks.filter(task => task.status === 'deployed' || task.status === 'review').length;
      inProgressTasks = parsed.tasks.filter(task => task.status === 'in_progress').length;
      blockedTasks = parsed.tasks.filter(task => task.status === 'blocked').length;
      pendingTasks = parsed.tasks.filter(task => task.status === 'pending').length;
    } catch {
      // Build may not have TASKS.md yet (backlog state)
    }

    // For backward compat: builds with docs but no status field are treated as 'planning'
    if (!meta?.status && totalTasks > 0) {
      buildStatus = 'planning';
    }
    if (
      buildStatus === 'blocked' &&
      Array.isArray(meta?.openQuestions) &&
      meta.openQuestions.map(q => String(q || '').trim()).filter(Boolean).length > 0
    ) {
      buildStatus = 'planning';
    }

    results.push({
      buildId,
      status: buildStatus,
      buildType: meta?.buildType || 'lite',
      description: meta?.description || '',
      totalTasks,
      doneTasks,
      inProgressTasks,
      blockedTasks,
      pendingTasks,
      gitEnabled: meta?.gitEnabled || false,
      prUrl: meta?.prUrl || null,
      prNumber: meta?.prNumber || null,
      openQuestions: Array.isArray(meta?.openQuestions)
        ? meta.openQuestions.map(q => String(q || '').trim()).filter(Boolean)
        : [],
      openQuestionsCount: Array.isArray(meta?.openQuestions)
        ? meta.openQuestions.map(q => String(q || '').trim()).filter(Boolean).length
        : 0,
      hasOpenQuestions: Array.isArray(meta?.openQuestions)
        ? meta.openQuestions.map(q => String(q || '').trim()).filter(Boolean).length > 0
        : false,
    });
  }

  return results;
}

async function nextBuildId() {
  const root = resolveBuildsRoot();
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });

  let max = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^v(\d+)$/);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }

  return `v${max + 1}`;
}

function resolveDocSet(buildType) {
  if (buildType === 'full') {
    return ['GOAL.md', 'TASKS.md', 'PLAN.md', 'DESIGN.md', 'TEST_PLAN.md', 'DECISIONS.md', 'REVIEW.md', 'SHIP.md', 'RECAP.md'];
  }
  return ['GOAL.md', 'TASKS.md', 'RECAP.md'];
}

function generateDocContent({ buildId, buildType, customType, description }) {
  const docs = {};
  docs['GOAL.md'] = buildGoalMarkdown({ buildId, buildType, customType, description });
  docs['TASKS.md'] = buildType === 'full'
    ? buildFullTasksMarkdown(buildId, description)
    : buildLiteTasksMarkdown(buildId, description);
  docs['RECAP.md'] = buildSimpleDoc(`Build ${buildId} Recap`, [
    '## What Shipped',
    '- TBD',
    '',
    '## Guard Results',
    '- TBD',
    '',
    '## Metrics',
    '- Lead time: TBD',
    '- Rework: TBD',
    '',
    '## Next Build Seeds',
    '- TBD',
  ]);

  if (buildType === 'full') {
    docs['PLAN.md'] = buildPlanMarkdown(buildId, description);
    docs['DESIGN.md'] = buildSimpleDoc(`Build ${buildId} Design`, ['## Objective', description || 'TBD']);
    docs['TEST_PLAN.md'] = buildSimpleDoc(`Build ${buildId} Test Plan`, ['## Goal', 'Validate task acceptance and guard coverage.']);
    docs['DECISIONS.md'] = buildSimpleDoc(`Build ${buildId} Decisions`, ['## Confirmed', '- TBD']);
    docs['REVIEW.md'] = buildSimpleDoc(`Build ${buildId} Review`, ['## Findings', '- TBD']);
    docs['SHIP.md'] = buildSimpleDoc(`Build ${buildId} Ship Checklist`, ['- [ ] All tasks done', '- [ ] Guard checks pass']);
  }

  return docs;
}

async function assistBuild({ description, buildType, customType }) {
  const normalized = normalizeBuildType(buildType);
  const suggestedType = normalized === 'custom'
    ? 'custom'
    : suggestBuildType(description);

  return {
    title: summarizeText(description, 'New Build'),
    buildType: normalized === 'custom' ? 'custom' : suggestedType,
    customType: normalized === 'custom' ? (customType || 'Custom') : '',
    questions: buildClarificationQuestions(description, suggestedType),
    notes: normalized === 'custom'
      ? 'Custom build will start with lite docs and can be expanded.'
      : '',
  };
}

async function createBuild({ description, buildType, customType }) {
  const normalizedType = normalizeBuildType(buildType);
  const buildId = await nextBuildId();
  const root = resolveBuildsRoot();
  const dir = path.join(root, buildId);
  await fs.mkdir(dir, { recursive: true });

  // Backlog builds: only write metadata, no docs yet
  const meta = {
    buildId,
    buildType: normalizedType,
    customType: normalizedType === 'custom' ? String(customType || '').trim() : '',
    description: String(description || '').trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    createdBy: 'dashboard',
    projectRoot: resolveProjectRoot(),
    // Git fields
    branchName: null,
    gitEnabled: false,
    taskMeta: {},
    prUrl: null,
    prNumber: null,
    openQuestions: [],
  };
  await writeBuildMeta(buildId, meta);

  return {
    buildId,
    buildType: normalizedType,
    status: 'pending',
    description: meta.description,
  };
}

async function planBuild(buildId) {
  const meta = await readBuildMeta(buildId);
  if (!meta) {
    throw new Error(`Build ${buildId} not found`);
  }

  if (meta.status && meta.status !== 'pending') {
    throw new Error(`Build ${buildId} is already in ${meta.status} state`);
  }

  const normalizedType = normalizeBuildType(meta.buildType);
  const dir = buildDirPath(buildId);

  // Generate all doc files for the build type
  const docSet = resolveDocSet(normalizedType);
  const docs = generateDocContent({
    buildId,
    buildType: normalizedType,
    customType: meta.customType,
    description: meta.description,
  });

  for (const docName of docSet) {
    const content = docs[docName] || buildSimpleDoc(docName.replace('.md', ''), ['TBD']);
    await fs.writeFile(path.join(dir, docName), content, 'utf8');
  }

  // Update status to planning
  meta.status = 'planning';
  meta.plannedAt = new Date().toISOString();
  meta.openQuestions = [];
  await writeBuildMeta(buildId, meta);

  const parsed = await getTasks(buildId);

  return {
    buildId,
    buildType: normalizedType,
    status: 'planning',
    description: meta.description,
    tasks: parsed.tasks,
    docsCreated: docSet,
  };
}

async function updateBuildStatus(buildId, newStatus, { validate = true } = {}) {
  const normalized = normalizeBuildStatus(newStatus);

  await lockAndWriteMeta(buildId, (meta) => {
    // Validate transition when requested (user-initiated moves)
    if (validate && meta.status !== normalized) {
      validateBuildTransition(meta.status, normalized);
    }
    meta.status = normalized;
  });

  return { buildId, status: normalized };
}

async function getTasks(buildId) {
  const { parsed } = await loadBuildTasks(buildId);

  // Guard: no task can be 'deployed' while build is still planning/pending
  const meta = await readBuildMeta(buildId);
  const buildStatus = normalizeBuildStatus(meta?.status);
  if (buildStatus === 'planning' || buildStatus === 'pending') {
    for (const task of parsed.tasks) {
      if (task.status === 'deployed') {
        task.status = 'pending';
      }
    }
  }

  return parsed;
}

async function createTask(buildId, taskInput) {
  const { parsed } = await loadBuildTasks(buildId);
  const task = sanitizeTaskInput({ ...taskInput, id: nextTaskId(parsed.tasks) });
  parsed.tasks.push(task);
  await saveBuildTasks(buildId, parsed);
  return task;
}

async function updateTask(buildId, taskId, updates) {
  const { parsed } = await loadBuildTasks(buildId);
  const idx = parsed.tasks.findIndex(task => task.id === taskId);
  if (idx === -1) {
    throw new Error(`Task ${taskId} not found`);
  }

  const merged = {
    ...parsed.tasks[idx],
    ...updates,
    id: taskId,
  };

  parsed.tasks[idx] = sanitizeTaskInput(merged);
  await saveBuildTasks(buildId, parsed);
  return parsed.tasks[idx];
}

async function deleteTask(buildId, taskId) {
  const { parsed } = await loadBuildTasks(buildId);
  const idx = parsed.tasks.findIndex(task => task.id === taskId);
  if (idx === -1) {
    throw new Error(`Task ${taskId} not found`);
  }

  const [removed] = parsed.tasks.splice(idx, 1);
  await saveBuildTasks(buildId, parsed);
  return removed;
}

async function reorderTasks(buildId, orderedTaskIds) {
  const { parsed } = await loadBuildTasks(buildId);
  const map = new Map(parsed.tasks.map(task => [task.id, task]));

  const reordered = [];
  for (const id of orderedTaskIds) {
    if (map.has(id)) {
      reordered.push(map.get(id));
      map.delete(id);
    }
  }

  for (const task of parsed.tasks) {
    if (map.has(task.id)) {
      reordered.push(task);
      map.delete(task.id);
    }
  }

  parsed.tasks = reordered;
  await saveBuildTasks(buildId, parsed);
  return parsed.tasks;
}

async function getBuildDocs(buildId) {
  sanitizeBuildId(buildId);
  const dir = buildDirPath(buildId);
  const meta = await readBuildMeta(buildId);
  if (!meta) {
    throw new Error(`Build ${buildId} not found`);
  }

  const docNames = ['GOAL.md', 'TASKS.md', 'RECAP.md', 'PLAN.md', 'DESIGN.md', 'REVIEW.md', 'SHIP.md', 'DECISIONS.md', 'TEST_PLAN.md'];
  const docs = {};

  for (const name of docNames) {
    const content = await readFileSafe(path.join(dir, name));
    if (content) {
      docs[name] = content;
    }
  }

  return docs;
}

const ALLOWED_DOC_NAMES = new Set([
  'GOAL.md', 'TASKS.md', 'RECAP.md', 'PLAN.md', 'DESIGN.md',
  'REVIEW.md', 'SHIP.md', 'DECISIONS.md', 'TEST_PLAN.md',
]);

async function saveBuildDoc(buildId, docName, content) {
  sanitizeBuildId(buildId);
  if (!ALLOWED_DOC_NAMES.has(docName)) {
    throw new Error(`Invalid document name: ${docName}`);
  }
  const meta = await readBuildMeta(buildId);
  if (!meta) {
    throw new Error(`Build ${buildId} not found`);
  }
  const dir = buildDirPath(buildId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, docName), content, 'utf8');
  return { buildId, docName, saved: true };
}

async function deleteBuild(buildId) {
  const dir = buildDirPath(buildId);
  // Verify the build exists
  const meta = await readBuildMeta(buildId);
  if (!meta) {
    throw new Error(`Build ${buildId} not found`);
  }

  // Clean up git worktrees and branches before deleting the build directory
  if (meta.gitEnabled && meta.taskMeta) {
    const gitService = require('./git-service');
    const projectRoot = meta.projectRoot || resolveProjectRoot();

    // Remove worktrees first (must happen before branch deletion)
    for (const [, taskMeta] of Object.entries(meta.taskMeta)) {
      if (taskMeta && taskMeta.worktreePath) {
        try {
          gitService.removeWorktree(projectRoot, taskMeta.worktreePath);
        } catch {
          // Don't let worktree cleanup failure block the delete
        }
      }
    }

    // Clean up task branches
    for (const [, taskMeta] of Object.entries(meta.taskMeta)) {
      if (taskMeta?.branchName) {
        try { gitService.deleteBranch(projectRoot, taskMeta.branchName); } catch {}
      }
    }

    // Clean up build-level branch
    if (meta.branchName) {
      try { gitService.deleteBranch(projectRoot, meta.branchName); } catch {}
    }
  }

  // Remove the entire build directory
  await fs.rm(dir, { recursive: true, force: true });
  return { buildId, deleted: true };
}

/**
 * Merge partial metadata into taskMeta[taskId] inside BUILD_META.json.
 */
async function updateTaskMeta(buildId, taskId, meta) {
  await lockAndWriteMeta(buildId, (buildMeta) => {
    if (!buildMeta.taskMeta) buildMeta.taskMeta = {};
    buildMeta.taskMeta[taskId] = {
      ...(buildMeta.taskMeta[taskId] || {}),
      ...meta,
    };
  });
}

/**
 * Read per-task metadata for a specific task.
 */
async function getTaskMeta(buildId, taskId) {
  const buildMeta = await readBuildMeta(buildId);
  return buildMeta?.taskMeta?.[taskId] || null;
}

module.exports = {
  DEFAULT_STATUS_KEY,
  resolveBuildsRoot,
  resolveProjectRoot,
  buildDirPath,
  tasksFilePath,
  getTasks,
  listBuilds,
  assistBuild,
  createBuild,
  planBuild,
  updateBuildStatus,
  readBuildMeta,
  writeBuildMeta,
  deleteBuild,
  getBuildDocs,
  saveBuildDoc,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  nextTaskId,
  parseTasksFile,
  serializeTasksFile,
  updateTaskMeta,
  getTaskMeta,
  lockAndWriteMeta,
};
