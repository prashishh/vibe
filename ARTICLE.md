---
title: "Vibe: An Opinionated Framework for Agentic Software Delivery"
date: 2026-02-22
---

![Vibe mascot](./screenshots/mascot.png)
*[PLACEHOLDER: Vibe mascot]*

## What Is Vibe

Vibe is an agentic software delivery framework. It gives AI coding assistants a structured way to plan, execute, and verify work inside any repository. Instead of typing instructions into a terminal and hoping the agent figures out the right sequence of steps, Vibe provides a set of skills that define the entire workflow from goal to shipped code.

The framework currently works with Claude Code and Codex, and the adapter system is built to expand to other AI coding CLIs over time. It installs into a repository as a set of markdown files, templates, and configurations. Everything is transparent, version controlled, and stored in a `.vibe/` directory alongside the codebase.

There is also a visual dashboard that lets developers plan builds, watch execution in real time, and manage tasks without touching the command line at all.

## Why It Exists

AI coding assistants have gotten very good at writing code. The problem is that writing code is only one part of shipping software. Planning what to build, breaking work into tasks, verifying that nothing broke, and documenting what shipped are all still manual processes that most developers handle ad hoc or skip entirely.

Sprints and ticket systems were designed for human teams coordinating over weeks. When an agent can go from a goal description to working code in a few hours, those systems add overhead without adding value. Vibe replaces that cycle with an outcome driven model where every piece of work starts with a defined goal and ends with verified results.

The framework is opinionated on purpose. It has a defined process for every type of task, it enforces planning before execution, and it uses permanent safety contracts called guards to protect core behavior across every build.

## Getting Started

Clone the repository and run the installer, then use `/start` inside any project to initialize. Full setup instructions are in the [README](./README.md).

![Vibe Dashboard](./screenshots/dashboard-main.png)
*[PLACEHOLDER: Dashboard screenshot showing active build with live streaming agent output and task queue]*

## The Skill System

Vibe ships with a set of skills that the AI assistant can invoke directly. These fall into two categories: autonomous workflows that run end to end, and manual commands that give step by step control.

### Autonomous Workflows

| Command | Scope | Risk | What It Does |
|---|---|---|---|
| `/vibe <fix>` | 1 to 3 tasks | Low only | Code, check, commit. No planning overhead, done in minutes. |
| `/lite <feature>` | 3 to 8 tasks | Low to Medium | Brainstorm, generate GOAL and TASKS, execute, verify, recap. |
| `/full <feature>` | 8+ tasks | Any | Full document set, multiple approval checkpoints, review and ship gates. |

### Manual Commands

| Command | What It Does |
|---|---|
| `/plan <feature>` | Create build documents with collaborative brainstorming |
| `/execute` | Work on the next pending task |
| `/check` | Run all guard tests and report pass or fail |
| `/review` | Produce a review document with PASS or BLOCKED status |
| `/ship` | Walk through a deployment checklist |
| `/recap` | Close the build, update the changelog, suggest next steps |
| `/propose` | Suggest the next build using seeds from the last recap |

### Auto Promotion

The framework detects when work outgrows its tier. If a `/vibe` quick fix breaks a guard or expands past three tasks, the framework automatically promotes it to a `/lite` or `/full` build. Developers do not need to predict complexity upfront.

## How Workflows Flow

Every piece of work is assigned to one of three tiers based on scope and risk. Each tier runs a defined sequence of phases and produces a specific set of documents.

```
New work arrives
│
├─ 1 to 3 tasks, Low risk, no core changes
│   └─ /vibe  →  implement  →  check  →  commit  →  changelog
│
├─ 3 to 8 tasks, Low or Medium risk, no architecture change
│   └─ /lite  →  brainstorm  →  GOAL + TASKS  →  execute  →  check  →  RECAP
│
└─ 8+ tasks, High risk, or architecture involved
    └─ /full  →  brainstorm  →  GOAL + PLAN + DESIGN + TASKS
                           →  execute  →  check  →  REVIEW gate
                           →  SHIP gate  →  RECAP
```

### What Each Workflow Publishes

Documents live inside a versioned build folder (`builds/vN/`). Quick fixes produce no build folder, just a commit and a one-line changelog entry.

| Document | `/vibe` | `/lite` | `/full` |
|---|---|---|---|
| `GOAL.md` | | Always | Always |
| `PLAN.md` | | If complex | Always |
| `DESIGN.md` | | | If architecture changes |
| `TASKS.md` | | Always | Always |
| `TEST_PLAN.md` | | | If complex |
| `REVIEW.md` | | If Medium+ risk | Always |
| `SHIP.md` | | If non-trivial deploy | Always |
| `RECAP.md` | | Always | Always |
| Commit | `vibe: ...` | `feat(vN/T-X): ...` | `feat(vN/T-X): ...` |
| Changelog | One line | Section | Section |

For `/full` builds, `REVIEW.md` must reach PASS status and `SHIP.md` must be fully checked off before the build can close. These are hard gates, not suggestions.

### Example: Starting a Lite Build

```
/lite add user avatar upload to profile settings
```

The agent opens with clarifying questions about scope, success criteria, edge cases, and risk. Once answered it generates `builds/v3/GOAL.md` and `builds/v3/TASKS.md`, pauses for approval, then executes all tasks autonomously and finishes with `builds/v3/RECAP.md`.

A `GOAL.md` looks like this:

```markdown
# Build v3: User Avatar Upload

## Intent
Add image upload to the profile settings page so users can set a personal avatar.
Stored in object storage, served via CDN. No third-party auth changes.

## Success Metric
1. Users can upload a JPEG or PNG up to 5 MB from the profile page.
2. Uploaded avatar is served within 500 ms via CDN URL.
3. Invalid file types and oversized files are rejected with clear error messages.
4. Previous avatar is replaced, not accumulated.

## Scope
### In
- Upload endpoint with file validation and storage write
- CDN URL stored in user profile record
- Profile settings UI with upload input and preview
- Error handling for type and size violations

### Out
- Avatar moderation or cropping
- Animated GIFs
- Avatar display in comments or other surfaces (next build)
```

And `TASKS.md` breaks that into individual tasks, each with an outcome statement, acceptance criteria, risk level, and rollback plan.

## Guards

Guards are append-only safety contracts that define what must never break. A guard is a higher-level statement about core behavior: unauthenticated requests must return 401, unauthorized writes must produce no state change, sensitive data must never appear in logs.

Every build, whether a quick fix or a complex multi-week effort, must pass all guards before it can close. This creates a one-directional ratchet where codebase stability only increases over time. New guards are added as the project grows, but existing guards can never be weakened or removed.

A typical `GUARDS.md` after initialization looks like this:

```markdown
# Guards

## G-01: Auth Boundary
- Contract: Protected routes require valid authentication.
- Invariants:
  - Unauthenticated calls return 401.
  - Invalid or expired credentials return 401.
- Layer: Contract + Integration
- Risk if broken: Total

## G-02: Authorization Matrix
- Contract: Authorization is server-enforced by role or policy.
- Invariants:
  - Allowed actions pass.
  - Disallowed actions return 403.
- Layer: Contract + Integration
- Risk if broken: Critical

## G-03: Core Write Protection
- Contract: Only authorized roles can mutate production-impacting config.
- Invariants:
  - Unauthorized write attempts produce no state change.
  - Denied writes return 403.
- Layer: Integration
- Risk if broken: Critical
```

## The Dashboard

The dashboard is a React application backed by a Node.js server with WebSocket support. It covers the full build lifecycle: creating and planning builds visually, watching task execution stream live, reviewing guard status across builds, browsing all build documents, and answering agent questions when it needs human input. A command reference inside the dashboard includes workflow diagrams for each skill. There is also a settings page for configuring LLM providers, concurrency limits, and file sync options.

![Vibe Dashboard — build detail](./screenshots/dashboard-build-detail.png)
*[PLACEHOLDER: Dashboard screenshot showing build detail with GOAL.md, TASKS.md rendered alongside live guard status]*

## Current State

This is an early alpha version. The core workflow, the dashboard, and the skill system are all functional and have been tested primarily with Claude Code. The adapter system supports Claude Code and Codex today, with skeleton adapters in place for Cursor, Windsurf, GitHub Copilot, Aider, Cline, and several others. Expanding and validating those integrations is the immediate next step.

The guard verification system will eventually support agent-level checks where guards described in natural language are validated by the AI itself. The parallel execution engine needs better dependency detection for builds where certain tasks genuinely depend on earlier results. These improvements and many others will come as the framework matures alongside the broader ecosystem of AI-assisted development tools.
