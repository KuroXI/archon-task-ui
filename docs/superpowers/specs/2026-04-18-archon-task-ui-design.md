# Archon Task UI — Design Spec

**Date:** 2026-04-18
**Status:** Approved

---

## Product Overview

A terminal UI (TUI) for monitoring Archon background workflow tasks. Invoked via `/archon-ui` as a Claude Code skill. Replaces the limited `/tasks` view with a live-updating, keyboard-navigable interface showing all running/recent Archon workflows, their step-by-step progress, and detailed tool call logs per step.

**Core value:** See exactly what an Archon workflow is doing right now — which node is active, which iteration it's on, and what tools it's calling — without leaving the terminal.

---

## Tech Stack

- **Runtime:** Bun (fast startup, built-in SQLite driver — no extra deps)
- **TUI framework:** Ink v5 (React for terminals)
- **Language:** TypeScript
- **Data sources:**
  - `archon isolation list --json` — active worktree/branch info
  - `~/.archon/archon.db` — Bun SQLite, read-only (workflow runs, events, logs)
- **Refresh:** 2-second polling via `useInterval` hook
- **Entry point:** `bun run src/index.tsx`
- **Invocation:** `/archon-ui` Claude Code skill shells out to the above command

---

## Layout — Sidebar + Detail Panel

```
┌─────────────────────────────────────────────────────────────────┐
│ ▸ ARCHON TASKS  [2 running]  [↑↓] navigate  [q] quit  [r] refresh │
├──────────────────────────┬──────────────────────────────────────┤
│ TASKS                    │ WORKFLOW STEPS — archon-adversarial  │
│                          │                                       │
│ ⟳ archon-adversarial-dev │ ✓  plan               12s            │
│   feat/my-app · 4m 32s   │ ✓  init-workspace     2s             │
│                          │ ⟳  adversarial-sprint  iter 4/60    │
│ ⟳ archon-fix-issue       │    sprint 1/4 · retry 1/3            │
│   fix/issue-42 · 1m 12s  │ ○  report                            │
│                          │                                       │
│ ✗ archon-pr-review       ├──────────────────────────────────────┤
│   review/pr-15 · failed  │ STEP OUTPUT — adversarial-sprint     │
│                          │                                       │
│                          │ tool: Bash                            │
│                          │   cd $ARTIFACTS/app && bun run test  │
│                          │ tool: Write                           │
│                          │   $ARTIFACTS/feedback/sprint-1-r1... │
│                          │ [evaluator] FAILED criterion          │
│                          │   api-returns-json → score 6/10      │
│                          │ [↑↓ scroll log]                       │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## Components

```
src/
├── index.tsx                   # Entry: renders <App>, sets up stdin raw mode
├── components/
│   ├── App.tsx                 # Root: manages selectedTaskId, polling, keyboard
│   ├── Header.tsx              # Top bar: task count, keybindings hint
│   ├── TaskList.tsx            # Left panel: scrollable list of TaskItem
│   ├── TaskItem.tsx            # One row: status icon + name + branch + elapsed
│   ├── DetailPanel.tsx         # Right panel: StepList + LogOutput
│   ├── StepList.tsx            # Workflow nodes with status icons + loop progress
│   └── LogOutput.tsx          # Scrollable tool call log for active step
├── data/
│   ├── db.ts                   # Bun SQLite queries against ~/.archon/archon.db
│   └── cli.ts                  # Shells out to `archon isolation list --json`
├── hooks/
│   └── useArchonTasks.ts       # Polling hook: merges CLI + DB, returns TaskState[]
└── types.ts                    # Shared types: Task, Step, LogEntry
```

---

## Data Model

### Task
Sourced from `remote_agent_workflow_runs`:
```ts
interface Task {
  id: string
  workflowName: string       // e.g. "archon-adversarial-dev"
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  workingPath: string        // project dir
  branch: string             // from remote_agent_isolation_environments.branch_name JOIN on workflow_run_id
  startedAt: Date
  elapsedMs: number          // computed
}
```

### Step
Derived from `remote_agent_workflow_events` (node_started / node_completed / node_failed / node_skipped):
```ts
interface Step {
  stepName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  durationMs?: number
  loopIteration?: number     // from loop_iteration_completed events
  loopTotal?: number         // from workflow metadata
  loopRetry?: number         // from loop_iteration_started data
}
```

### LogEntry
Sourced from `tool_called` / `tool_completed` events for the active step:
```ts
interface LogEntry {
  toolName: string
  inputPreview: string       // first 120 chars of tool_input JSON
  durationMs?: number
  createdAt: Date
}
```

---

## Data Queries

**Task list** (polls every 2s):
```sql
SELECT id, workflow_name, status, working_path, started_at
FROM remote_agent_workflow_runs
ORDER BY started_at DESC
LIMIT 50
```

**Steps for selected task:**
```sql
SELECT event_type, step_name, step_index, data, created_at
FROM remote_agent_workflow_events
WHERE workflow_run_id = ?
  AND event_type IN (
    'node_started', 'node_completed', 'node_failed', 'node_skipped',
    'loop_iteration_started', 'loop_iteration_completed'
  )
ORDER BY created_at ASC
```

**Log entries for active step (auto-tails last 50):**
```sql
SELECT event_type, step_name, data, created_at
FROM remote_agent_workflow_events
WHERE workflow_run_id = ?
  AND step_name = ?
  AND event_type IN ('tool_called', 'tool_completed')
ORDER BY created_at DESC
LIMIT 50
```
LogOutput renders newest-at-bottom. No focus switching — `j`/`k` scroll while `↑`/`↓` navigate task list.

---

## Keyboard Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate task list |
| `q` | Quit |
| `r` | Force refresh |
| `j` / `k` | Scroll log output up/down (vim-style, always active) |

---

## Skill File

`skill.md` (placed in `.claude/skills/` or registered via Claude Code):
- Trigger: `/archon-ui`
- Action: runs `bun run src/index.tsx` in the `archon-task-ui` project directory
- No AI inference — pure shell execution, zero token cost per refresh

---

## Error Handling

- DB not found (`~/.archon/archon.db` missing): show "No Archon DB found. Run an Archon workflow first."
- `archon` CLI not in PATH: skip isolation list, use DB only
- Empty task list: show "No tasks found. Run `archon workflow run ...` to start one."
- SQLite read error: display error inline in panel, keep polling

---

## Out of Scope

- Writing to the Archon DB or controlling workflows (read-only)
- Authentication / remote Archon instances
- Windows-specific ANSI workarounds (Bun + Ink handle this)
- Historical analytics / charts
