# Archon Task UI

A live-updating terminal dashboard for monitoring [Archon](https://github.com/coleam00/Archon) background workflow tasks — because `/tasks` doesn't show you enough.

```
▸ ARCHON TASKS  [2 running]  [↑↓] navigate  [j/k] scroll log  [r] refresh  [q] quit
┌────────────────────────────┬─────────────────────────────────────────────────────┐
│ TASKS                      │ WORKFLOW STEPS — adversarial-dev · feat/my-app      │
│                            │                                                     │
│ ⟳ adversarial-dev          │ ✓  plan               12s                           │
│   feat/my-app · 4m 32s     │ ✓  init-workspace     2s                            │
│                            │ ⟳  adversarial-sprint  iter 4/60 · retry 1/3        │
│ ⟳ fix-issue                │ ○  report                                           │
│   fix/issue-42 · 1m 12s    │                                                     │
│                            │ STEP OUTPUT — adversarial-sprint                    │
│ ✗ pr-review                │ tool: Bash  →  git add -A && git commit -m "feat…"  │
│   review/pr-15 · failed    │ tool: Write  →  $ARTIFACTS/feedback/sprint-1.json   │
│                            │ [evaluator] FAILED criterion → retry 1/3            │
└────────────────────────────┴─────────────────────────────────────────────────────┘
```

## Requirements

- [Bun](https://bun.sh) ≥ 1.1.0
- [Archon CLI](https://github.com/coleam00/Archon) installed and configured
- Claude Code

## Install

**macOS / Linux / WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/apexj/archon-task-ui/master/install.sh | bash
```

**Windows PowerShell:**
```powershell
irm https://raw.githubusercontent.com/apexj/archon-task-ui/master/install.ps1 | iex
```

**Windows CMD:**
```cmd
curl -fsSL https://raw.githubusercontent.com/apexj/archon-task-ui/master/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Then open a new terminal and run `archon-ui`.

> **Note for Windows:** Requires [Git for Windows](https://git-scm.com/downloads/win). WSL setups do not need it.

### Options

| Flag | Description |
|------|-------------|
| `--no-modify-path` | Skip PATH changes — add `~/.archon/bin` (or `%USERPROFILE%\.archon\bin`) to PATH manually |

## Update

Run install again — it pulls latest and re-writes the skill file:

```bash
bash ~/.archon/tools/archon-task-ui/install.sh
```

## Usage

In any Claude Code session:

```
/archon-ui
```

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate task list |
| `j` / `k` | Scroll log output |
| `r` | Force refresh |
| `q` | Quit |

## What it shows

- All workflow runs from `~/.archon/archon.db` (running, completed, failed, cancelled)
- Per-task: workflow name, branch, elapsed time, status
- Per-step: node status (✓/⟳/✗/○), loop iteration, retry count, duration
- Step logs: every tool call with input preview and duration

## Run directly (without skill)

```bash
cd ~/.archon/tools/archon-task-ui
bun run src/index.tsx

# Custom DB path:
bun run src/index.tsx --db /path/to/archon.db
```
