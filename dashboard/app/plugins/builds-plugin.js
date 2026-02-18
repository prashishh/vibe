import fs from 'fs'
import path from 'path'

// Use environment variables or fall back to demo
const BUILDS_DIR = process.env.VITE_BUILDS_PATH
  ? path.resolve(process.env.VITE_BUILDS_PATH)
  : path.resolve(import.meta.dirname, '../../../demo-project/.vibe/builds')

const FRAMEWORK_DOC = path.resolve(import.meta.dirname, '../../../core/VIBE.md')

const GUARDRAILS_DOC = process.env.VITE_GUARDS_PATH
  ? path.resolve(process.env.VITE_GUARDS_PATH)
  : path.resolve(import.meta.dirname, '../../../demo-project/.vibe/GUARDS.md')

const CHANGELOG_DOC = process.env.VITE_CHANGELOG_PATH
  ? path.resolve(process.env.VITE_CHANGELOG_PATH)
  : path.resolve(import.meta.dirname, '../../../demo-project/.vibe/CHANGELOG.md')

const VIRTUAL_MODULE_ID = 'virtual:builds-data'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID

function parseTasksFromPlan(planContent) {
  const tasks = []
  const taskRegex = /^### (T-\d+):\s*(.+)$/gm
  let match

  while ((match = taskRegex.exec(planContent)) !== null) {
    const taskId = match[1]
    const title = match[2]

    // Extract fields after this task header until next task or end
    const startIdx = match.index + match[0].length
    const nextTaskMatch = planContent.indexOf('\n### T-', startIdx)
    const taskBlock = planContent.slice(startIdx, nextTaskMatch === -1 ? undefined : nextTaskMatch)

    const riskMatch = taskBlock.match(/^- Risk:\s*(.+)$/m)
    const outcomeMatch = taskBlock.match(/^- Outcome:\s*(.+)$/m)
    const guardrailsMatch = taskBlock.match(/^- (?:Guards|Guardrails) touched:\s*(.+)$/m)

    tasks.push({
      id: taskId,
      title,
      risk: riskMatch ? riskMatch[1].trim() : 'Unknown',
      outcome: outcomeMatch ? outcomeMatch[1].trim() : '',
      guardrails: guardrailsMatch ? guardrailsMatch[1].trim() : '',
    })
  }

  return tasks
}

function parseTaskStatuses(tasksContent) {
  const statuses = {}
  const tableRegex = /\|\s*(T-\d+)\s*\|[^|]*\|[^|]*\|\s*(\w+)\s*\|/g
  let match

  while ((match = tableRegex.exec(tasksContent)) !== null) {
    statuses[match[1]] = match[2].trim()
  }

  return statuses
}

function parseTaskStatusesInline(tasksContent) {
  const statuses = {}
  const sections = tasksContent.split(/(?=^### T-\d+)/m)
  for (const section of sections) {
    const idMatch = section.match(/^### (T-\d+)/)
    const statusMatch = section.match(/^\s*-\s*\*\*Status\*\*:\s*(\w+)/m)
    if (idMatch && statusMatch) {
      statuses[idMatch[1]] = statusMatch[1].trim()
    }
  }
  return statuses
}

function parseGoal(goalContent) {
  const intentMatch = goalContent.match(/## Intent\n([\s\S]*?)(?=\n##|$)/)
  const scopeInMatch = goalContent.match(/### In\n([\s\S]*?)(?=\n###|$)/)
  const scopeOutMatch = goalContent.match(/### Out\n([\s\S]*?)(?=\n##|$)/)
  const successMatch = goalContent.match(/## Success Metric\n([\s\S]*?)(?=\n##|$)/)
  const guardrailImpactMatch = goalContent.match(/## (?:Guard|Guardrail) Impact\n([\s\S]*?)(?=\n##|$)/)

  const guardrailImpact = []
  if (guardrailImpactMatch) {
    const lines = guardrailImpactMatch[1].trim().split('\n')
    for (const line of lines) {
      const m = line.match(/^-\s*(G-\d+[^:]*):?\s*(.+)$/)
      if (m) {
        guardrailImpact.push({ id: m[1].trim(), impact: m[2].trim() })
      }
    }
  }

  return {
    intent: intentMatch ? intentMatch[1].trim() : '',
    successMetric: successMatch ? successMatch[1].trim() : '',
    scopeIn: scopeInMatch ? scopeInMatch[1].trim() : '',
    scopeOut: scopeOutMatch ? scopeOutMatch[1].trim() : '',
    guardrailImpact,
  }
}

function parseRecap(recapContent) {
  const shippedMatch = recapContent.match(/## What Shipped\n([\s\S]*?)(?=\n##|$)/)
  const metricsMatch = recapContent.match(/## Metrics\n([\s\S]*?)(?=\n##|$)/)
  const seedsMatch = recapContent.match(/## Next Build Seeds\n([\s\S]*?)(?=\n##|$)/)

  return {
    shipped: shippedMatch ? shippedMatch[1].trim() : 'TBD',
    metrics: metricsMatch ? metricsMatch[1].trim() : 'TBD',
    seeds: seedsMatch ? seedsMatch[1].trim() : 'TBD',
  }
}

function readFileOr(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return fallback
  }
}

function parseChangelog(content) {
  if (!content) return []

  const entries = []
  const lines = content.split('\n')
  let current = null

  for (const line of lines) {
    // Build entry: ## [v1] Title
    const buildMatch = line.match(/^## \[v(\d+)\]\s*(.+)$/)
    if (buildMatch) {
      if (current) entries.push(current)
      current = {
        type: 'build',
        version: `v${buildMatch[1]}`,
        title: buildMatch[2].trim(),
        items: [],
      }
      continue
    }

    // Vibe entry: ## Vibe: 2025-02-15 — Description
    const vibeMatch = line.match(/^## Vibe:\s*(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)$/)
    if (vibeMatch) {
      if (current) entries.push(current)
      current = {
        type: 'vibe',
        date: vibeMatch[1],
        title: vibeMatch[2].trim(),
        items: [],
      }
      continue
    }

    // Bullet items under current entry
    const itemMatch = line.match(/^- (.+)$/)
    if (itemMatch && current) {
      current.items.push(itemMatch[1].trim())
    }
  }

  if (current) entries.push(current)
  return entries
}

function scanBuilds() {
  const builds = []

  if (!fs.existsSync(BUILDS_DIR)) {
    return { builds, framework: '', guardrails: '' }
  }

  const dirs = fs.readdirSync(BUILDS_DIR)
    .filter(d => d.startsWith('v') && fs.statSync(path.join(BUILDS_DIR, d)).isDirectory())
    .sort((a, b) => {
      const numA = parseInt(a.replace('v', ''), 10)
      const numB = parseInt(b.replace('v', ''), 10)
      return numA - numB
    })

  for (const dir of dirs) {
    const buildPath = path.join(BUILDS_DIR, dir)
    const version = dir

    const goalRaw = readFileOr(path.join(buildPath, 'GOAL.md'))
    const planRaw = readFileOr(path.join(buildPath, 'PLAN.md'))
    const tasksRaw = readFileOr(path.join(buildPath, 'TASKS.md'))
    const designRaw = readFileOr(path.join(buildPath, 'DESIGN.md'))
    const shipRaw = readFileOr(path.join(buildPath, 'SHIP.md'))
    const recapRaw = readFileOr(path.join(buildPath, 'RECAP.md'))
    const testPlanRaw = readFileOr(path.join(buildPath, 'TEST_PLAN.md'))
    const decisionsRaw = readFileOr(path.join(buildPath, 'DECISIONS.md'))
    const reviewRaw = readFileOr(path.join(buildPath, 'REVIEW.md'))

    // Parse title from GOAL.md first heading
    const titleMatch = goalRaw.match(/^#\s*(.+)$/m)
    const title = titleMatch ? titleMatch[1].replace(/^Build\s+v\d+:\s*/, '') : version

    // Determine build type based on which documents exist
    const buildType = (!planRaw && !designRaw && !testPlanRaw && !decisionsRaw && !shipRaw)
      ? 'lite'
      : 'full'

    const goal = parseGoal(goalRaw)

    // Try PLAN.md first (full builds), fall back to TASKS.md (lite builds)
    let tasks = parseTasksFromPlan(planRaw)
    if (tasks.length === 0) {
      tasks = parseTasksFromPlan(tasksRaw)
    }

    // Merge task statuses from both inline and table formats
    const taskStatuses = {
      ...parseTaskStatusesInline(tasksRaw),
      ...parseTaskStatuses(tasksRaw),
    }
    const recap = parseRecap(recapRaw)

    // Merge statuses into tasks
    for (const task of tasks) {
      task.status = taskStatuses[task.id] || 'pending'
    }

    const totalTasks = tasks.length
    const doneTasks = tasks.filter(t => t.status === 'done').length
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length

    let status = 'planning'
    if (doneTasks === totalTasks && totalTasks > 0) {
      status = 'completed'
    } else if (inProgressTasks > 0 || doneTasks > 0) {
      status = 'in_progress'
    }

    builds.push({
      version,
      title,
      buildType,
      status,
      goal,
      tasks,
      totalTasks,
      doneTasks,
      recap,
      docs: {
        goal: goalRaw,
        plan: planRaw,
        tasks: tasksRaw,
        design: designRaw,
        ship: shipRaw,
        recap: recapRaw,
        testPlan: testPlanRaw,
        decisions: decisionsRaw,
        review: reviewRaw,
      },
    })
  }

  const framework = readFileOr(FRAMEWORK_DOC)
  const guardrails = readFileOr(GUARDRAILS_DOC)
  const changelogRaw = readFileOr(CHANGELOG_DOC)
  const changelog = parseChangelog(changelogRaw)

  return { builds, framework, guardrails, changelog, changelogRaw }
}

export function buildsPlugin() {
  return {
    name: 'builds-data',
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID
    },
    load(id) {
      if (id === RESOLVED_ID) {
        const data = scanBuilds()
        return `export default ${JSON.stringify(data)}`
      }
    },
    configureServer(server) {
      // Watch external project files (builds dir, guards, changelog)
      // Vite only watches its own project root by default, so we add
      // external paths to its watcher and listen for changes
      const watchPaths = [BUILDS_DIR, GUARDRAILS_DOC, CHANGELOG_DOC].filter(p => {
        try { return fs.existsSync(p) } catch { return false }
      })

      if (watchPaths.length === 0) return

      for (const p of watchPaths) {
        server.watcher.add(p)
      }

      server.watcher.on('change', (file) => {
        const isBuild = file.startsWith(BUILDS_DIR)
        const isGuardOrChangelog = file === GUARDRAILS_DOC || file === CHANGELOG_DOC

        if (isBuild || isGuardOrChangelog) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
          }
          // Only full-reload for guards/changelog changes.
          // Build file changes are handled by the API + SSE — the kanban
          // dashboard doesn't use virtual:builds-data, so full-reload
          // would just destroy React state (sidebar, logs, etc.)
          if (isGuardOrChangelog) {
            server.ws.send({ type: 'full-reload', path: '*' })
          }
        }
      })

      server.watcher.on('add', (file) => {
        if (file.startsWith(BUILDS_DIR)) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
            // No full-reload — let SSE + API handle live updates
          }
        }
      })
    },
    handleHotUpdate({ file, server }) {
      const isBuild = file.includes('builds/') || file.includes(BUILDS_DIR)
      const isGuardOrChangelog =
        file.includes('GUARDS.md') || file.includes('CHANGELOG.md') ||
        file === GUARDRAILS_DOC || file === CHANGELOG_DOC

      if (isBuild || isGuardOrChangelog) {
        const module = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (module) {
          server.moduleGraph.invalidateModule(module)
        }
        // Only full-reload for guards/changelog — not build files
        if (isGuardOrChangelog && !isBuild) {
          server.ws.send({ type: 'full-reload', path: '*' })
        }
      }
    },
  }
}
