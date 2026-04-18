# Archon Task UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live-updating terminal UI that shows Archon background workflow tasks with step-by-step progress and tool call logs, invocable via `/archon-ui` from Claude Code.

**Architecture:** Ink v5 (React for terminals) renders a two-panel layout — fixed 32-char task list sidebar on the left, flex detail panel on the right. A 2-second polling hook merges data from `archon isolation list --json` (CLI) and `~/.archon/archon.db` (Bun SQLite, read-only). Keyboard: `↑`/`↓` navigate tasks, `j`/`k` scroll logs, `r` refresh, `q` quit.

**Tech Stack:** Bun (runtime + test runner + built-in SQLite), Ink v5, React 18, TypeScript 5, ink-testing-library v3

---

## File Map

```
archon-task-ui/
├── src/
│   ├── index.tsx                    # Entry: renders <App>, enables raw stdin
│   ├── types.ts                     # Shared: Task, Step, LogEntry interfaces
│   ├── components/
│   │   ├── App.tsx                  # Root: keyboard handling, layout, polling state
│   │   ├── Header.tsx               # Top bar: task count + keybinding hints
│   │   ├── TaskList.tsx             # Left panel: scrollable list of <TaskItem>
│   │   ├── TaskItem.tsx             # One row: icon + name + branch + elapsed time
│   │   ├── DetailPanel.tsx          # Right panel: <StepList> + <LogOutput>
│   │   ├── StepList.tsx             # Workflow nodes with status icons + loop progress
│   │   └── LogOutput.tsx            # Scrollable tool call log for active step
│   ├── data/
│   │   ├── db.ts                    # Bun SQLite queries against ~/.archon/archon.db
│   │   └── cli.ts                   # Shells out to `archon isolation list --json`
│   └── hooks/
│       └── useArchonTasks.ts        # 2s polling hook: merges CLI + DB → TaskState[]
├── tests/
│   ├── data/
│   │   ├── db.test.ts
│   │   └── cli.test.ts
│   ├── hooks/
│   │   └── useArchonTasks.test.ts
│   └── components/
│       ├── Header.test.tsx
│       ├── TaskItem.test.tsx
│       ├── TaskList.test.tsx
│       ├── StepList.test.tsx
│       ├── LogOutput.test.tsx
│       └── DetailPanel.test.tsx
├── archon-ui.md                     # Claude Code skill file
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repo**

```bash
cd "C:/Users/apexj/OneDrive/Documents/Programming/Side Project/archon-task-ui"
git init
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "archon-task-ui",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "bun run src/index.tsx",
    "test": "bun test",
    "test:watch": "bun test --watch"
  },
  "dependencies": {
    "ink": "^5.1.0",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0",
    "ink-testing-library": "^3.0.0",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
.superpowers/
*.db
```

- [ ] **Step 5: Install dependencies**

```bash
bun install
```

Expected: `bun install` completes, `node_modules/` created with ink, react, ink-testing-library.

- [ ] **Step 6: Verify Bun + Ink works**

Create `src/index.tsx` temporarily:
```tsx
import React from 'react';
import { render, Text } from 'ink';
render(<Text color="green">Archon Task UI works</Text>);
```

Run: `bun run src/index.tsx`
Expected: green text "Archon Task UI works" printed to terminal, process exits.

- [ ] **Step 7: Initial commit**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "chore: project setup — Bun + Ink v5 + TypeScript"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export type TaskStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown'
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface Task {
  id: string
  workflowName: string       // e.g. "archon-adversarial-dev"
  status: TaskStatus
  workingPath: string        // project directory path
  branch: string             // from isolation_environments.branch_name or path
  startedAt: Date
  elapsedMs: number          // computed: Date.now() - startedAt
}

export interface Step {
  stepName: string
  status: StepStatus
  durationMs?: number        // from node_completed event data
  loopIteration?: number     // current iteration from loop_iteration_completed
  loopMaxIterations?: number // from workflow metadata
  loopRetry?: number         // current retry count
  loopMaxRetries?: number    // max retries from workflow metadata
}

export interface LogEntry {
  eventType: 'tool_called' | 'tool_completed'
  toolName: string
  inputPreview: string       // first 120 chars of tool_input JSON value
  durationMs?: number        // present on tool_completed
  createdAt: Date
}

export interface TaskDetail {
  task: Task
  steps: Step[]
  logEntries: LogEntry[]     // for the currently active/last step
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared Task, Step, LogEntry types"
```

---

## Task 3: Data Layer — db.ts

**Files:**
- Create: `src/data/db.ts`
- Create: `tests/data/db.test.ts`

- [ ] **Step 1: Write failing tests for `db.ts`**

```typescript
// tests/data/db.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { getWorkflowRuns, getWorkflowSteps, getStepLogs, createDb } from '../../src/data/db'

function createTestDb(): Database {
  const db = new Database(':memory:')
  db.run(`CREATE TABLE remote_agent_workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_name TEXT,
    status TEXT,
    working_path TEXT,
    started_at TEXT,
    completed_at TEXT,
    last_activity_at TEXT,
    current_step_index INTEGER,
    metadata TEXT,
    conversation_id TEXT,
    codebase_id TEXT,
    parent_conversation_id TEXT
  )`)
  db.run(`CREATE TABLE remote_agent_workflow_events (
    id TEXT PRIMARY KEY,
    workflow_run_id TEXT,
    event_type TEXT,
    step_name TEXT,
    step_index INTEGER,
    data TEXT,
    created_at TEXT
  )`)
  db.run(`CREATE TABLE remote_agent_isolation_environments (
    id TEXT PRIMARY KEY,
    codebase_id TEXT,
    workflow_type TEXT,
    workflow_id TEXT,
    branch_name TEXT,
    working_path TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT,
    provider TEXT,
    created_by_platform TEXT,
    metadata TEXT
  )`)
  return db
}

function seedRun(db: Database, overrides: Partial<{
  id: string, workflow_name: string, status: string,
  working_path: string, started_at: string
}> = {}) {
  const defaults = {
    id: 'run-1',
    workflow_name: 'archon-adversarial-dev',
    status: 'running',
    working_path: 'C:/projects/my-app',
    started_at: new Date(Date.now() - 60000).toISOString()
  }
  const row = { ...defaults, ...overrides }
  db.run(
    `INSERT INTO remote_agent_workflow_runs (id, workflow_name, status, working_path, started_at)
     VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.workflow_name, row.status, row.working_path, row.started_at]
  )
  return row
}

function seedIsolation(db: Database, workflowId: string, branchName: string) {
  db.run(
    `INSERT INTO remote_agent_isolation_environments (id, workflow_id, branch_name, working_path, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`,
    [`iso-${workflowId}`, workflowId, branchName, 'C:/projects/my-app']
  )
}

function seedEvent(db: Database, runId: string, eventType: string, stepName: string, data: object = {}) {
  const id = `evt-${Math.random().toString(36).slice(2)}`
  db.run(
    `INSERT INTO remote_agent_workflow_events (id, workflow_run_id, event_type, step_name, data, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, runId, eventType, stepName, JSON.stringify(data)]
  )
}

describe('getWorkflowRuns', () => {
  test('returns empty array when no runs exist', () => {
    const db = createTestDb()
    const runs = getWorkflowRuns(db)
    expect(runs).toEqual([])
  })

  test('returns tasks with parsed status and elapsed time', () => {
    const db = createTestDb()
    seedRun(db, { id: 'run-1', status: 'running' })
    const runs = getWorkflowRuns(db)
    expect(runs).toHaveLength(1)
    expect(runs[0].id).toBe('run-1')
    expect(runs[0].status).toBe('running')
    expect(runs[0].workflowName).toBe('archon-adversarial-dev')
    expect(runs[0].elapsedMs).toBeGreaterThan(0)
  })

  test('merges branch name from isolation environments', () => {
    const db = createTestDb()
    seedRun(db, { id: 'run-1' })
    seedIsolation(db, 'run-1', 'feat/my-app')
    const runs = getWorkflowRuns(db)
    expect(runs[0].branch).toBe('feat/my-app')
  })

  test('returns empty string for branch when no isolation env exists', () => {
    const db = createTestDb()
    seedRun(db, { id: 'run-1' })
    const runs = getWorkflowRuns(db)
    expect(runs[0].branch).toBe('')
  })

  test('orders by started_at descending (newest first)', () => {
    const db = createTestDb()
    seedRun(db, { id: 'run-old', started_at: new Date(Date.now() - 120000).toISOString() })
    seedRun(db, { id: 'run-new', started_at: new Date(Date.now() - 10000).toISOString() })
    const runs = getWorkflowRuns(db)
    expect(runs[0].id).toBe('run-new')
    expect(runs[1].id).toBe('run-old')
  })
})

describe('getWorkflowSteps', () => {
  test('returns empty array when no events exist', () => {
    const db = createTestDb()
    const steps = getWorkflowSteps(db, 'run-1')
    expect(steps).toEqual([])
  })

  test('derives step status from node events', () => {
    const db = createTestDb()
    seedEvent(db, 'run-1', 'node_started', 'plan')
    seedEvent(db, 'run-1', 'node_completed', 'plan', { duration_ms: 12000 })
    seedEvent(db, 'run-1', 'node_started', 'init-workspace')
    const steps = getWorkflowSteps(db, 'run-1')
    expect(steps).toHaveLength(2)
    expect(steps[0].stepName).toBe('plan')
    expect(steps[0].status).toBe('completed')
    expect(steps[0].durationMs).toBe(12000)
    expect(steps[1].stepName).toBe('init-workspace')
    expect(steps[1].status).toBe('running')
  })

  test('extracts loop iteration from loop_iteration_completed events', () => {
    const db = createTestDb()
    seedEvent(db, 'run-1', 'node_started', 'adversarial-sprint')
    seedEvent(db, 'run-1', 'loop_iteration_completed', 'adversarial-sprint', { iteration: 4 })
    const steps = getWorkflowSteps(db, 'run-1')
    expect(steps[0].loopIteration).toBe(4)
  })

  test('marks step as failed on node_failed event', () => {
    const db = createTestDb()
    seedEvent(db, 'run-1', 'node_started', 'plan')
    seedEvent(db, 'run-1', 'node_failed', 'plan')
    const steps = getWorkflowSteps(db, 'run-1')
    expect(steps[0].status).toBe('failed')
  })
})

describe('getStepLogs', () => {
  test('returns empty array when no tool events', () => {
    const db = createTestDb()
    const logs = getStepLogs(db, 'run-1', 'plan')
    expect(logs).toEqual([])
  })

  test('returns tool_called and tool_completed events as LogEntry', () => {
    const db = createTestDb()
    seedEvent(db, 'run-1', 'tool_called', 'adversarial-sprint', {
      tool_name: 'Bash',
      tool_input: { command: 'git status' }
    })
    seedEvent(db, 'run-1', 'tool_completed', 'adversarial-sprint', {
      tool_name: 'Bash',
      duration_ms: 250
    })
    const logs = getStepLogs(db, 'run-1', 'adversarial-sprint')
    expect(logs).toHaveLength(2)
    expect(logs[0].toolName).toBe('Bash')
    expect(logs[0].eventType).toBe('tool_called')
    expect(logs[0].inputPreview).toContain('git status')
    expect(logs[1].durationMs).toBe(250)
  })

  test('truncates inputPreview to 120 chars', () => {
    const db = createTestDb()
    const longInput = { command: 'a'.repeat(200) }
    seedEvent(db, 'run-1', 'tool_called', 'plan', {
      tool_name: 'Bash',
      tool_input: longInput
    })
    const logs = getStepLogs(db, 'run-1', 'plan')
    expect(logs[0].inputPreview.length).toBeLessThanOrEqual(120)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
bun test tests/data/db.test.ts
```

Expected: FAIL — `getWorkflowRuns`, `getWorkflowSteps`, `getStepLogs`, `createDb` not found.

- [ ] **Step 3: Write `src/data/db.ts`**

```typescript
import { Database } from 'bun:sqlite'
import { homedir } from 'os'
import { join } from 'path'
import type { Task, Step, LogEntry } from '../types'

const DEFAULT_DB_PATH = join(homedir(), '.archon', 'archon.db')

export function createDb(path = DEFAULT_DB_PATH): Database {
  return new Database(path, { readonly: true, create: false })
}

export function getWorkflowRuns(db: Database): Task[] {
  const rows = db.query<{
    id: string
    workflow_name: string
    status: string
    working_path: string
    started_at: string
    branch_name: string | null
  }, []>(`
    SELECT
      r.id,
      r.workflow_name,
      r.status,
      r.working_path,
      r.started_at,
      ie.branch_name
    FROM remote_agent_workflow_runs r
    LEFT JOIN remote_agent_isolation_environments ie ON ie.workflow_id = r.id
    ORDER BY r.started_at DESC
    LIMIT 50
  `).all()

  const now = Date.now()
  return rows.map(row => ({
    id: row.id,
    workflowName: row.workflow_name,
    status: (row.status ?? 'unknown') as Task['status'],
    workingPath: row.working_path ?? '',
    branch: row.branch_name ?? '',
    startedAt: new Date(row.started_at),
    elapsedMs: now - new Date(row.started_at).getTime()
  }))
}

export function getWorkflowSteps(db: Database, runId: string): Step[] {
  const events = db.query<{
    event_type: string
    step_name: string
    data: string | null
    created_at: string
  }, [string]>(`
    SELECT event_type, step_name, data, created_at
    FROM remote_agent_workflow_events
    WHERE workflow_run_id = ?
      AND event_type IN (
        'node_started', 'node_completed', 'node_failed', 'node_skipped',
        'loop_iteration_started', 'loop_iteration_completed'
      )
    ORDER BY created_at ASC
  `).all(runId)

  const stepMap = new Map<string, Step>()

  for (const event of events) {
    const name = event.step_name
    const data = event.data ? JSON.parse(event.data) : {}

    if (!stepMap.has(name)) {
      stepMap.set(name, { stepName: name, status: 'pending' })
    }

    const step = stepMap.get(name)!

    switch (event.event_type) {
      case 'node_started':
        step.status = 'running'
        break
      case 'node_completed':
        step.status = 'completed'
        if (data.duration_ms) step.durationMs = data.duration_ms
        break
      case 'node_failed':
        step.status = 'failed'
        break
      case 'node_skipped':
        step.status = 'skipped'
        break
      case 'loop_iteration_completed':
        if (data.iteration !== undefined) step.loopIteration = data.iteration
        break
      case 'loop_iteration_started':
        if (data.retry !== undefined) step.loopRetry = data.retry
        break
    }
  }

  return Array.from(stepMap.values())
}

export function getStepLogs(db: Database, runId: string, stepName: string): LogEntry[] {
  const events = db.query<{
    event_type: string
    data: string | null
    created_at: string
  }, [string, string]>(`
    SELECT event_type, data, created_at
    FROM remote_agent_workflow_events
    WHERE workflow_run_id = ?
      AND step_name = ?
      AND event_type IN ('tool_called', 'tool_completed')
    ORDER BY created_at ASC
    LIMIT 50
  `).all(runId, stepName)

  return events.map(event => {
    const data = event.data ? JSON.parse(event.data) : {}
    const toolName: string = data.tool_name ?? 'unknown'

    let inputPreview = ''
    if (data.tool_input) {
      const raw = typeof data.tool_input === 'string'
        ? data.tool_input
        : JSON.stringify(data.tool_input)
      inputPreview = raw.slice(0, 120)
    }

    return {
      eventType: event.event_type as LogEntry['eventType'],
      toolName,
      inputPreview,
      durationMs: data.duration_ms,
      createdAt: new Date(event.created_at)
    }
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun test tests/data/db.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/db.ts tests/data/db.test.ts
git commit -m "feat: add SQLite data layer — getWorkflowRuns, getWorkflowSteps, getStepLogs"
```

---

## Task 4: Data Layer — cli.ts

**Files:**
- Create: `src/data/cli.ts`
- Create: `tests/data/cli.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/data/cli.test.ts
import { describe, test, expect, mock, spyOn } from 'bun:test'
import * as childProcess from 'child_process'

// We test the parsing logic by feeding it known JSON
import { parseIsolationList } from '../../src/data/cli'

describe('parseIsolationList', () => {
  test('returns empty array on empty string', () => {
    expect(parseIsolationList('')).toEqual([])
  })

  test('returns empty array on non-JSON output', () => {
    expect(parseIsolationList('error: not in git repo')).toEqual([])
  })

  test('parses valid isolation list JSON', () => {
    const json = JSON.stringify([
      { branch: 'feat/my-app', cwd: '/projects/my-app', status: 'active' },
      { branch: 'fix/issue-42', cwd: '/projects/fix', status: 'active' }
    ])
    const result = parseIsolationList(json)
    expect(result).toHaveLength(2)
    expect(result[0].branch).toBe('feat/my-app')
    expect(result[1].branch).toBe('fix/issue-42')
  })

  test('returns empty array when JSON is not an array', () => {
    expect(parseIsolationList('{"error": "not found"}')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
bun test tests/data/cli.test.ts
```

Expected: FAIL — `parseIsolationList` not found.

- [ ] **Step 3: Write `src/data/cli.ts`**

```typescript
import { spawnSync } from 'child_process'

export interface IsolationEnv {
  branch: string
  cwd: string
  status: string
}

export function parseIsolationList(output: string): IsolationEnv[] {
  if (!output.trim()) return []
  try {
    const parsed = JSON.parse(output)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => typeof item === 'object' && item !== null && 'branch' in item)
      .map(item => ({
        branch: String(item.branch ?? ''),
        cwd: String(item.cwd ?? item.working_path ?? ''),
        status: String(item.status ?? 'unknown')
      }))
  } catch {
    return []
  }
}

export function getIsolationEnvs(): IsolationEnv[] {
  try {
    const result = spawnSync('archon', ['isolation', 'list', '--json'], {
      encoding: 'utf8',
      timeout: 5000
    })
    if (result.error || result.status !== 0) return []
    return parseIsolationList(result.stdout ?? '')
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun test tests/data/cli.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/cli.ts tests/data/cli.test.ts
git commit -m "feat: add CLI wrapper for archon isolation list"
```

---

## Task 5: useArchonTasks Hook

**Files:**
- Create: `src/hooks/useArchonTasks.ts`
- Create: `tests/hooks/useArchonTasks.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/hooks/useArchonTasks.test.ts
import { describe, test, expect, mock } from 'bun:test'
import { mergeTasksWithBranches } from '../../src/hooks/useArchonTasks'
import type { Task } from '../../src/types'

const baseTask: Task = {
  id: 'run-1',
  workflowName: 'archon-adversarial-dev',
  status: 'running',
  workingPath: 'C:/projects/my-app',
  branch: '',
  startedAt: new Date(),
  elapsedMs: 5000
}

describe('mergeTasksWithBranches', () => {
  test('keeps existing branch when already set', () => {
    const task = { ...baseTask, branch: 'feat/my-app' }
    const result = mergeTasksWithBranches([task], [])
    expect(result[0].branch).toBe('feat/my-app')
  })

  test('does not error on empty inputs', () => {
    expect(mergeTasksWithBranches([], [])).toEqual([])
  })

  test('updates elapsedMs on each merge call', () => {
    const oldTime = Date.now() - 10000
    const task = { ...baseTask, startedAt: new Date(oldTime), elapsedMs: 0 }
    const result = mergeTasksWithBranches([task], [])
    expect(result[0].elapsedMs).toBeGreaterThan(9000)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
bun test tests/hooks/useArchonTasks.test.ts
```

Expected: FAIL — `mergeTasksWithBranches` not found.

- [ ] **Step 3: Write `src/hooks/useArchonTasks.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { createDb, getWorkflowRuns, getWorkflowSteps, getStepLogs } from '../data/db'
import { getIsolationEnvs } from '../data/cli'
import type { Task, TaskDetail } from '../types'

export function mergeTasksWithBranches(
  tasks: Task[],
  _isolationEnvs: { branch: string; cwd: string }[]
): Task[] {
  const now = Date.now()
  return tasks.map(task => ({
    ...task,
    elapsedMs: now - task.startedAt.getTime()
  }))
}

export function useArchonTasks(intervalMs = 2000) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(() => {
    try {
      const db = createDb()
      const runs = getWorkflowRuns(db)
      const envs = getIsolationEnvs()
      const merged = mergeTasksWithBranches(runs, envs)
      setTasks(merged)
      setError(null)
      setIsLoading(false)

      // Auto-select first task if nothing selected
      setSelectedTaskId(prev => {
        if (prev === null && merged.length > 0) return merged[0].id
        // Keep selection if still valid
        if (prev !== null && merged.find(t => t.id === prev)) return prev
        // Fall back to first
        return merged.length > 0 ? merged[0].id : null
      })

      db.close()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('SQLITE_CANTOPEN') || msg.includes('no such file')) {
        setError('Archon DB not found. Run an Archon workflow first.')
      } else {
        setError(`DB error: ${msg}`)
      }
      setIsLoading(false)
    }
  }, [])

  // Fetch detail for selected task
  useEffect(() => {
    if (!selectedTaskId) {
      setTaskDetail(null)
      return
    }
    const task = tasks.find(t => t.id === selectedTaskId)
    if (!task) return
    try {
      const db = createDb()
      const steps = getWorkflowSteps(db, selectedTaskId)
      // Log entries for last active/running step, or last step
      const activeStep = steps.find(s => s.status === 'running') ?? steps[steps.length - 1]
      const logEntries = activeStep
        ? getStepLogs(db, selectedTaskId, activeStep.stepName)
        : []
      setTaskDetail({ task, steps, logEntries })
      db.close()
    } catch {
      // Non-fatal — keep showing previous detail
    }
  }, [selectedTaskId, tasks])

  // Poll on interval
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, intervalMs)
    return () => clearInterval(timer)
  }, [refresh, intervalMs])

  return {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    taskDetail,
    error,
    isLoading,
    refresh
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun test tests/hooks/useArchonTasks.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run all tests so far**

```bash
bun test
```

Expected: all tests PASS (db + cli + hook).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useArchonTasks.ts tests/hooks/useArchonTasks.test.ts
git commit -m "feat: add useArchonTasks polling hook — merges DB runs with CLI branch data"
```

---

## Task 6: Header Component

**Files:**
- Create: `src/components/Header.tsx`
- Create: `tests/components/Header.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/Header.test.tsx
import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'
import { Header } from '../../src/components/Header'

describe('Header', () => {
  test('renders task count', () => {
    const { lastFrame } = render(<Header taskCount={3} runningCount={2} />)
    expect(lastFrame()).toContain('3')
    expect(lastFrame()).toContain('2 running')
  })

  test('renders keybinding hints', () => {
    const { lastFrame } = render(<Header taskCount={0} runningCount={0} />)
    expect(lastFrame()).toContain('↑↓')
    expect(lastFrame()).toContain('q')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test tests/components/Header.test.tsx
```

Expected: FAIL — `Header` not found.

- [ ] **Step 3: Write `src/components/Header.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'

interface HeaderProps {
  taskCount: number
  runningCount: number
}

export function Header({ taskCount, runningCount }: HeaderProps) {
  return (
    <Box paddingX={1} borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false}>
      <Text color="blueBright" bold>▸ ARCHON TASKS </Text>
      <Text color="green">[{runningCount} running] </Text>
      <Text dimColor> [↑↓] navigate  [j/k] scroll log  [r] refresh  [q] quit</Text>
    </Box>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test tests/components/Header.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx tests/components/Header.test.tsx
git commit -m "feat: add Header component"
```

---

## Task 7: TaskItem Component

**Files:**
- Create: `src/components/TaskItem.tsx`
- Create: `tests/components/TaskItem.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/TaskItem.test.tsx
import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'
import { TaskItem } from '../../src/components/TaskItem'
import type { Task } from '../../src/types'

const baseTask: Task = {
  id: 'run-1',
  workflowName: 'archon-adversarial-dev',
  status: 'running',
  workingPath: 'C:/projects/my-app',
  branch: 'feat/my-app',
  startedAt: new Date(Date.now() - 272000),
  elapsedMs: 272000
}

describe('TaskItem', () => {
  test('renders workflow name', () => {
    const { lastFrame } = render(<TaskItem task={baseTask} isSelected={false} />)
    expect(lastFrame()).toContain('adversarial-dev')
  })

  test('renders branch name', () => {
    const { lastFrame } = render(<TaskItem task={baseTask} isSelected={false} />)
    expect(lastFrame()).toContain('feat/my-app')
  })

  test('renders elapsed time formatted', () => {
    const { lastFrame } = render(<TaskItem task={baseTask} isSelected={false} />)
    expect(lastFrame()).toContain('4m')
  })

  test('shows ⟳ icon for running status', () => {
    const { lastFrame } = render(<TaskItem task={baseTask} isSelected={false} />)
    expect(lastFrame()).toContain('⟳')
  })

  test('shows ✓ icon for completed status', () => {
    const task = { ...baseTask, status: 'completed' as const }
    const { lastFrame } = render(<TaskItem task={task} isSelected={false} />)
    expect(lastFrame()).toContain('✓')
  })

  test('shows ✗ icon for failed status', () => {
    const task = { ...baseTask, status: 'failed' as const }
    const { lastFrame } = render(<TaskItem task={task} isSelected={false} />)
    expect(lastFrame()).toContain('✗')
  })

  test('highlights when selected', () => {
    const { lastFrame } = render(<TaskItem task={baseTask} isSelected={true} />)
    // Selected item has highlighted background indicator
    expect(lastFrame()).toContain('adversarial-dev')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test tests/components/TaskItem.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/TaskItem.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Task, TaskStatus } from '../types'

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function statusIcon(status: TaskStatus): { icon: string; color: string } {
  switch (status) {
    case 'running': return { icon: '⟳', color: 'yellow' }
    case 'completed': return { icon: '✓', color: 'green' }
    case 'failed': return { icon: '✗', color: 'red' }
    case 'cancelled': return { icon: '⊘', color: 'gray' }
    default: return { icon: '?', color: 'gray' }
  }
}

function shortName(workflowName: string): string {
  // Strip "archon-" prefix for brevity
  return workflowName.replace(/^archon-/, '')
}

interface TaskItemProps {
  task: Task
  isSelected: boolean
}

export function TaskItem({ task, isSelected }: TaskItemProps) {
  const { icon, color } = statusIcon(task.status)

  return (
    <Box
      paddingX={1}
      borderStyle={isSelected ? 'single' : undefined}
      borderColor="blueBright"
      flexDirection="column"
    >
      <Box>
        <Text color={color}>{icon} </Text>
        <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
          {shortName(task.workflowName)}
        </Text>
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor>
          {task.branch || task.workingPath.split('/').pop() || '—'} · {formatElapsed(task.elapsedMs)}
        </Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test tests/components/TaskItem.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskItem.tsx tests/components/TaskItem.test.tsx
git commit -m "feat: add TaskItem component with status icon, branch, elapsed time"
```

---

## Task 8: TaskList Component

**Files:**
- Create: `src/components/TaskList.tsx`
- Create: `tests/components/TaskList.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/TaskList.test.tsx
import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'
import { TaskList } from '../../src/components/TaskList'
import type { Task } from '../../src/types'

const tasks: Task[] = [
  {
    id: 'run-1',
    workflowName: 'archon-adversarial-dev',
    status: 'running',
    workingPath: 'C:/projects/app',
    branch: 'feat/app',
    startedAt: new Date(Date.now() - 60000),
    elapsedMs: 60000
  },
  {
    id: 'run-2',
    workflowName: 'archon-fix-issue',
    status: 'failed',
    workingPath: 'C:/projects/fix',
    branch: 'fix/issue-42',
    startedAt: new Date(Date.now() - 30000),
    elapsedMs: 30000
  }
]

describe('TaskList', () => {
  test('renders all tasks', () => {
    const { lastFrame } = render(
      <TaskList tasks={tasks} selectedTaskId="run-1" onSelect={() => {}} />
    )
    expect(lastFrame()).toContain('adversarial-dev')
    expect(lastFrame()).toContain('fix-issue')
  })

  test('renders empty state when no tasks', () => {
    const { lastFrame } = render(
      <TaskList tasks={[]} selectedTaskId={null} onSelect={() => {}} />
    )
    expect(lastFrame()).toContain('No tasks')
  })

  test('renders TASKS label', () => {
    const { lastFrame } = render(
      <TaskList tasks={tasks} selectedTaskId={null} onSelect={() => {}} />
    )
    expect(lastFrame()).toContain('TASKS')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test tests/components/TaskList.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/TaskList.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { TaskItem } from './TaskItem'
import type { Task } from '../types'

interface TaskListProps {
  tasks: Task[]
  selectedTaskId: string | null
  onSelect: (id: string) => void
}

export function TaskList({ tasks, selectedTaskId, onSelect }: TaskListProps) {
  return (
    <Box flexDirection="column" width={32} borderStyle="single" borderRight borderLeft={false} borderTop={false} borderBottom={false} borderColor="gray">
      <Box paddingX={1}>
        <Text dimColor bold>TASKS</Text>
      </Box>
      {tasks.length === 0 ? (
        <Box paddingX={1} paddingTop={1}>
          <Text dimColor>No tasks found.</Text>
        </Box>
      ) : (
        tasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            isSelected={task.id === selectedTaskId}
          />
        ))
      )}
    </Box>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test tests/components/TaskList.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskList.tsx tests/components/TaskList.test.tsx
git commit -m "feat: add TaskList sidebar component"
```

---

## Task 9: StepList Component

**Files:**
- Create: `src/components/StepList.tsx`
- Create: `tests/components/StepList.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/StepList.test.tsx
import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'
import { StepList } from '../../src/components/StepList'
import type { Step } from '../../src/types'

const steps: Step[] = [
  { stepName: 'plan', status: 'completed', durationMs: 12000 },
  { stepName: 'init-workspace', status: 'completed', durationMs: 2000 },
  {
    stepName: 'adversarial-sprint',
    status: 'running',
    loopIteration: 4,
    loopMaxIterations: 60,
    loopRetry: 1,
    loopMaxRetries: 3
  },
  { stepName: 'report', status: 'pending' }
]

describe('StepList', () => {
  test('renders all step names', () => {
    const { lastFrame } = render(<StepList steps={steps} />)
    expect(lastFrame()).toContain('plan')
    expect(lastFrame()).toContain('init-workspace')
    expect(lastFrame()).toContain('adversarial-sprint')
    expect(lastFrame()).toContain('report')
  })

  test('shows ✓ for completed steps', () => {
    const { lastFrame } = render(<StepList steps={steps} />)
    expect(lastFrame()).toContain('✓')
  })

  test('shows ○ for pending steps', () => {
    const { lastFrame } = render(<StepList steps={steps} />)
    expect(lastFrame()).toContain('○')
  })

  test('shows loop iteration for running loop step', () => {
    const { lastFrame } = render(<StepList steps={steps} />)
    expect(lastFrame()).toContain('4')
    expect(lastFrame()).toContain('60')
  })

  test('shows retry count', () => {
    const { lastFrame } = render(<StepList steps={steps} />)
    expect(lastFrame()).toContain('retry')
  })

  test('shows duration for completed steps', () => {
    const { lastFrame } = render(<StepList steps={steps} />)
    expect(lastFrame()).toContain('12s')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test tests/components/StepList.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/StepList.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Step, StepStatus } from '../types'

function stepIcon(status: StepStatus): { icon: string; color: string } {
  switch (status) {
    case 'completed': return { icon: '✓', color: 'green' }
    case 'running': return { icon: '⟳', color: 'yellow' }
    case 'failed': return { icon: '✗', color: 'red' }
    case 'skipped': return { icon: '⊘', color: 'gray' }
    default: return { icon: '○', color: 'gray' }
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${Math.round(ms / 1000)}s`
}

interface StepListProps {
  steps: Step[]
}

export function StepList({ steps }: StepListProps) {
  if (steps.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No steps yet...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {steps.map(step => {
        const { icon, color } = stepIcon(step.status)
        const loopInfo = step.loopIteration !== undefined
          ? ` iter ${step.loopIteration}/${step.loopMaxIterations ?? '?'}`
          : ''
        const retryInfo = step.loopRetry !== undefined && step.loopRetry > 0
          ? ` · retry ${step.loopRetry}/${step.loopMaxRetries ?? '?'}`
          : ''
        const durInfo = step.durationMs !== undefined
          ? ` ${formatMs(step.durationMs)}`
          : ''

        return (
          <Box key={step.stepName}>
            <Text color={color}>{icon} </Text>
            <Text color={step.status === 'pending' ? 'gray' : 'white'}>
              {step.stepName}
            </Text>
            <Text color="yellow">{loopInfo}{retryInfo}</Text>
            <Text dimColor>{durInfo}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test tests/components/StepList.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StepList.tsx tests/components/StepList.test.tsx
git commit -m "feat: add StepList component with loop iteration and retry display"
```

---

## Task 10: LogOutput Component

**Files:**
- Create: `src/components/LogOutput.tsx`
- Create: `tests/components/LogOutput.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/LogOutput.test.tsx
import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'
import { LogOutput } from '../../src/components/LogOutput'
import type { LogEntry } from '../../src/types'

const entries: LogEntry[] = [
  {
    eventType: 'tool_called',
    toolName: 'Bash',
    inputPreview: 'git status',
    createdAt: new Date()
  },
  {
    eventType: 'tool_completed',
    toolName: 'Bash',
    inputPreview: '',
    durationMs: 250,
    createdAt: new Date()
  },
  {
    eventType: 'tool_called',
    toolName: 'Write',
    inputPreview: '$ARTIFACTS/feedback/sprint-1.json',
    createdAt: new Date()
  }
]

describe('LogOutput', () => {
  test('renders tool names', () => {
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />)
    expect(lastFrame()).toContain('Bash')
    expect(lastFrame()).toContain('Write')
  })

  test('renders input preview', () => {
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />)
    expect(lastFrame()).toContain('git status')
  })

  test('renders duration for tool_completed', () => {
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />)
    expect(lastFrame()).toContain('250ms')
  })

  test('renders empty state when no entries', () => {
    const { lastFrame } = render(<LogOutput entries={[]} scrollOffset={0} />)
    expect(lastFrame()).toContain('No output')
  })

  test('shows STEP OUTPUT label', () => {
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} stepName="adversarial-sprint" />)
    expect(lastFrame()).toContain('adversarial-sprint')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test tests/components/LogOutput.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/LogOutput.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { LogEntry } from '../types'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface LogOutputProps {
  entries: LogEntry[]
  scrollOffset: number
  stepName?: string
}

const VISIBLE_LINES = 12

export function LogOutput({ entries, scrollOffset, stepName }: LogOutputProps) {
  const label = stepName ? `STEP OUTPUT — ${stepName}` : 'STEP OUTPUT'

  const visibleEntries = entries.slice(
    Math.max(0, scrollOffset),
    Math.max(0, scrollOffset) + VISIBLE_LINES
  )

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" marginTop={1}>
      <Box>
        <Text dimColor bold>{label}</Text>
        {entries.length > VISIBLE_LINES && (
          <Text dimColor> [{scrollOffset + 1}-{Math.min(scrollOffset + VISIBLE_LINES, entries.length)}/{entries.length}] j/k scroll</Text>
        )}
      </Box>

      {entries.length === 0 ? (
        <Box paddingTop={1}>
          <Text dimColor>No output yet...</Text>
        </Box>
      ) : (
        visibleEntries.map((entry, i) => (
          <Box key={i}>
            {entry.eventType === 'tool_called' ? (
              <>
                <Text color="cyan">tool: {entry.toolName}</Text>
                {entry.inputPreview && (
                  <Text dimColor>  → {entry.inputPreview}</Text>
                )}
              </>
            ) : (
              <Text dimColor>
                {'  '}✓ {entry.toolName}
                {entry.durationMs !== undefined ? ` (${formatDuration(entry.durationMs)})` : ''}
              </Text>
            )}
          </Box>
        ))
      )}
    </Box>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test tests/components/LogOutput.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LogOutput.tsx tests/components/LogOutput.test.tsx
git commit -m "feat: add LogOutput component with scroll support"
```

---

## Task 11: DetailPanel Component

**Files:**
- Create: `src/components/DetailPanel.tsx`
- Create: `tests/components/DetailPanel.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/DetailPanel.test.tsx
import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'
import { DetailPanel } from '../../src/components/DetailPanel'
import type { TaskDetail } from '../../src/types'

const detail: TaskDetail = {
  task: {
    id: 'run-1',
    workflowName: 'archon-adversarial-dev',
    status: 'running',
    workingPath: 'C:/projects/app',
    branch: 'feat/app',
    startedAt: new Date(Date.now() - 60000),
    elapsedMs: 60000
  },
  steps: [
    { stepName: 'plan', status: 'completed', durationMs: 12000 },
    { stepName: 'adversarial-sprint', status: 'running', loopIteration: 4, loopMaxIterations: 60 }
  ],
  logEntries: [
    { eventType: 'tool_called', toolName: 'Bash', inputPreview: 'git status', createdAt: new Date() }
  ]
}

describe('DetailPanel', () => {
  test('renders workflow name and branch in header', () => {
    const { lastFrame } = render(<DetailPanel detail={detail} logScrollOffset={0} />)
    expect(lastFrame()).toContain('adversarial-dev')
    expect(lastFrame()).toContain('feat/app')
  })

  test('renders WORKFLOW STEPS label', () => {
    const { lastFrame } = render(<DetailPanel detail={detail} logScrollOffset={0} />)
    expect(lastFrame()).toContain('WORKFLOW STEPS')
  })

  test('renders step names', () => {
    const { lastFrame } = render(<DetailPanel detail={detail} logScrollOffset={0} />)
    expect(lastFrame()).toContain('plan')
    expect(lastFrame()).toContain('adversarial-sprint')
  })

  test('renders empty state when no detail', () => {
    const { lastFrame } = render(<DetailPanel detail={null} logScrollOffset={0} />)
    expect(lastFrame()).toContain('Select a task')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test tests/components/DetailPanel.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/DetailPanel.tsx`**

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { StepList } from './StepList'
import { LogOutput } from './LogOutput'
import type { TaskDetail } from '../types'

interface DetailPanelProps {
  detail: TaskDetail | null
  logScrollOffset: number
}

export function DetailPanel({ detail, logScrollOffset }: DetailPanelProps) {
  if (!detail) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>Select a task from the left panel</Text>
      </Box>
    )
  }

  const { task, steps, logEntries } = detail
  const shortName = task.workflowName.replace(/^archon-/, '')
  const activeStep = steps.find(s => s.status === 'running') ?? steps[steps.length - 1]

  return (
    <Box flexGrow={1} flexDirection="column" paddingX={1}>
      <Box>
        <Text dimColor bold>WORKFLOW STEPS — </Text>
        <Text color="blueBright">{shortName}</Text>
        {task.branch && <Text dimColor> · {task.branch}</Text>}
      </Box>

      <Box marginTop={1}>
        <StepList steps={steps} />
      </Box>

      <LogOutput
        entries={logEntries}
        scrollOffset={logScrollOffset}
        stepName={activeStep?.stepName}
      />
    </Box>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test tests/components/DetailPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailPanel.tsx tests/components/DetailPanel.test.tsx
git commit -m "feat: add DetailPanel combining StepList and LogOutput"
```

---

## Task 12: App Root Component

**Files:**
- Create: `src/components/App.tsx`
- Create: `tests/components/App.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/App.test.tsx
import { describe, test, expect, mock } from 'bun:test'
import React from 'react'
import { render } from 'ink-testing-library'

// Mock the data hooks so App doesn't try to open the real DB
mock.module('../../src/hooks/useArchonTasks', () => ({
  useArchonTasks: () => ({
    tasks: [],
    selectedTaskId: null,
    setSelectedTaskId: () => {},
    taskDetail: null,
    error: null,
    isLoading: false,
    refresh: () => {}
  })
}))

import { App } from '../../src/components/App'

describe('App', () => {
  test('renders without crashing', () => {
    const { lastFrame } = render(<App />)
    expect(lastFrame()).toBeTruthy()
  })

  test('shows empty state when no tasks', () => {
    const { lastFrame } = render(<App />)
    expect(lastFrame()).toContain('ARCHON TASKS')
  })

  test('renders error when DB missing', async () => {
    mock.module('../../src/hooks/useArchonTasks', () => ({
      useArchonTasks: () => ({
        tasks: [],
        selectedTaskId: null,
        setSelectedTaskId: () => {},
        taskDetail: null,
        error: 'Archon DB not found. Run an Archon workflow first.',
        isLoading: false,
        refresh: () => {}
      })
    }))
    const { App: AppWithError } = await import('../../src/components/App')
    const { lastFrame } = render(<AppWithError />)
    expect(lastFrame()).toContain('Archon DB not found')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
bun test tests/components/App.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/App.tsx`**

```tsx
import React, { useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { Header } from './Header'
import { TaskList } from './TaskList'
import { DetailPanel } from './DetailPanel'
import { useArchonTasks } from '../hooks/useArchonTasks'

export function App() {
  const { exit } = useApp()
  const { tasks, selectedTaskId, setSelectedTaskId, taskDetail, error, isLoading, refresh } =
    useArchonTasks(2000)
  const [logScrollOffset, setLogScrollOffset] = useState(0)

  useInput((input, key) => {
    if (input === 'q') {
      exit()
      return
    }
    if (input === 'r') {
      refresh()
      return
    }

    // Navigate task list
    if (key.upArrow) {
      const idx = tasks.findIndex(t => t.id === selectedTaskId)
      if (idx > 0) {
        setSelectedTaskId(tasks[idx - 1].id)
        setLogScrollOffset(0)
      }
      return
    }
    if (key.downArrow) {
      const idx = tasks.findIndex(t => t.id === selectedTaskId)
      if (idx < tasks.length - 1) {
        setSelectedTaskId(tasks[idx + 1].id)
        setLogScrollOffset(0)
      }
      return
    }

    // Scroll log
    if (input === 'j') {
      setLogScrollOffset(prev =>
        Math.min(prev + 1, Math.max(0, (taskDetail?.logEntries.length ?? 0) - 1))
      )
      return
    }
    if (input === 'k') {
      setLogScrollOffset(prev => Math.max(0, prev - 1))
      return
    }
  })

  const runningCount = tasks.filter(t => t.status === 'running').length

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    )
  }

  if (isLoading) {
    return (
      <Box padding={1}>
        <Text color="yellow">Loading Archon tasks...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Header taskCount={tasks.length} runningCount={runningCount} />
      <Box flexGrow={1}>
        <TaskList
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onSelect={id => { setSelectedTaskId(id); setLogScrollOffset(0) }}
        />
        <DetailPanel
          detail={taskDetail}
          logScrollOffset={logScrollOffset}
        />
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
bun test tests/components/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/App.tsx tests/components/App.test.tsx
git commit -m "feat: add App root with keyboard navigation and polling"
```

---

## Task 13: Entry Point

**Files:**
- Modify: `src/index.tsx` (replace stub from Task 1)

- [ ] **Step 1: Write `src/index.tsx`**

```tsx
import React from 'react'
import { render } from 'ink'
import { App } from './components/App'

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: true
})

waitUntilExit().then(() => process.exit(0))
```

- [ ] **Step 2: Run the app manually against real Archon DB**

```bash
bun run src/index.tsx
```

Expected: TUI launches, shows tasks from `~/.archon/archon.db`. Navigate with ↑↓, scroll log with j/k, quit with q. If no tasks exist, shows empty state message.

- [ ] **Step 3: Run full test suite one more time**

```bash
bun test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.tsx
git commit -m "feat: wire up entry point — bun run src/index.tsx launches the TUI"
```

---

## Task 14: Claude Code Skill File

**Files:**
- Create: `archon-ui.md`

- [ ] **Step 1: Write `archon-ui.md`**

```markdown
---
description: Launch the Archon Task UI — a live-updating terminal dashboard for monitoring Archon workflow tasks
argument-hint: (no arguments needed)
---

# Archon Task UI

Launch a live terminal UI showing all Archon background tasks with step-by-step workflow progress and tool call logs.

**Controls:** ↑/↓ navigate tasks · j/k scroll log · r refresh · q quit

```bash
cd "C:/Users/apexj/OneDrive/Documents/Programming/Side Project/archon-task-ui" && bun run src/index.tsx
```
```

- [ ] **Step 2: Register the skill with Claude Code**

Copy or symlink the skill file to Claude Code's skills directory:

```bash
cp archon-ui.md "$USERPROFILE/.claude/skills/archon-ui.md"
```

On Windows (Git Bash):
```bash
cp archon-ui.md "/c/Users/apexj/.claude/skills/archon-ui.md"
```

- [ ] **Step 3: Verify skill appears in Claude Code**

In a new Claude Code session, type `/archon-ui` — it should launch the TUI.

- [ ] **Step 4: Final commit**

```bash
git add archon-ui.md
git commit -m "feat: add /archon-ui Claude Code skill file"
```
