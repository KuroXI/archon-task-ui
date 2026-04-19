import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join } from "path";
import type { WorkflowRun, WorkflowEvent, StepSummary, ToolCallEntry } from "../types.js";

const DEFAULT_DB_PATH = join(homedir(), ".archon", "archon.db");

export function openDb(path?: string): Database {
  const dbPath = path ?? DEFAULT_DB_PATH;
  // :memory: cannot be opened read-only; open it RW and initialize schema for testing
  if (dbPath === ":memory:") {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS remote_agent_workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_name TEXT NOT NULL,
        status TEXT NOT NULL,
        working_path TEXT,
        started_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS remote_agent_workflow_events (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        step_name TEXT,
        data TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS remote_agent_isolation_environments (
        workflow_id TEXT PRIMARY KEY,
        branch_name TEXT NOT NULL
      );
    `);
    return db;
  }
  return new Database(dbPath, { readonly: true });
}

export function fetchWorkflowRuns(db: Database): WorkflowRun[] {
  const rows = db.query<{
    id: string;
    workflow_name: string;
    status: string;
    working_path: string | null;
    started_at: string;
    branch_name: string | null;
    ended_at: string | null;
  }, []>(`
    SELECT
      r.id,
      r.workflow_name,
      r.status,
      r.working_path,
      r.started_at,
      e.branch_name,
      (SELECT MAX(ev.created_at) FROM remote_agent_workflow_events ev WHERE ev.workflow_run_id = r.id) AS ended_at
    FROM remote_agent_workflow_runs r
    LEFT JOIN remote_agent_isolation_environments e ON e.workflow_id = r.id
    ORDER BY
      CASE r.status WHEN 'running' THEN 0 ELSE 1 END,
      r.started_at DESC
  `).all();

  const now = Date.now();

  return rows.map((row) => {
    const startedAt = new Date(row.started_at).getTime();
    const endMs = row.status !== "running" && row.ended_at
      ? new Date(row.ended_at).getTime()
      : now;
    const elapsedSeconds = Math.floor((endMs - startedAt) / 1000);

    const workflowName = row.workflow_name.startsWith("archon-")
      ? row.workflow_name.slice("archon-".length)
      : row.workflow_name;

    return {
      id: row.id,
      workflowName,
      status: row.status,
      workingPath: row.working_path,
      startedAt: row.started_at,
      branchName: row.branch_name,
      elapsedSeconds,
    };
  });
}

export function fetchWorkflowEvents(db: Database, runId: string): WorkflowEvent[] {
  const rows = db.query<{
    id: string;
    workflow_run_id: string;
    event_type: string;
    step_name: string | null;
    data: string | null;
    created_at: string;
  }, [string]>(`
    SELECT id, workflow_run_id, event_type, step_name, data, created_at
    FROM remote_agent_workflow_events
    WHERE workflow_run_id = ?
    ORDER BY created_at ASC
  `).all(runId);

  return rows.map((row) => ({
    id: row.id,
    workflowRunId: row.workflow_run_id,
    eventType: row.event_type,
    stepName: row.step_name,
    data: row.data,
    createdAt: row.created_at,
  }));
}

export function buildStepSummaries(events: WorkflowEvent[]): StepSummary[] {
  // Track steps in order of first appearance
  const stepOrder: string[] = [];
  const stepMap = new Map<string, {
    startedAt: string;
    completedAt: string | null;
    status: string;
    loopIteration: number | null;
    maxIterations: number | null;
    retryCount: number | null;
  }>();

  for (const event of events) {
    if (event.eventType === "node_started" && event.stepName) {
      if (!stepMap.has(event.stepName)) {
        stepOrder.push(event.stepName);
        // Parse retry count from data JSON
        let retryCount: number | null = null;
        if (event.data) {
          try {
            const parsed = JSON.parse(event.data) as Record<string, unknown>;
            if (typeof parsed.retry_count === "number") {
              retryCount = parsed.retry_count;
            }
          } catch {
            // ignore parse errors
          }
        }
        stepMap.set(event.stepName, {
          startedAt: event.createdAt,
          completedAt: null,
          status: "running",
          loopIteration: null,
          maxIterations: null,
          retryCount,
        });
      }
    } else if (event.eventType === "node_completed" && event.stepName) {
      const step = stepMap.get(event.stepName);
      if (step) {
        // Parse retry count from data JSON (may be updated on completion)
        let retryCount = step.retryCount;
        if (event.data) {
          try {
            const parsed = JSON.parse(event.data) as Record<string, unknown>;
            if (typeof parsed.retry_count === "number") {
              retryCount = parsed.retry_count;
            }
          } catch {
            // ignore parse errors
          }
        }
        step.completedAt = event.createdAt;
        step.status = "completed";
        step.retryCount = retryCount;
      }
    } else if (event.eventType === "node_failed" && event.stepName) {
      const step = stepMap.get(event.stepName);
      if (step) {
        let retryCount = step.retryCount;
        if (event.data) {
          try {
            const parsed = JSON.parse(event.data) as Record<string, unknown>;
            if (typeof parsed.retry_count === "number") {
              retryCount = parsed.retry_count;
            }
          } catch {
            // ignore parse errors
          }
        }
        step.completedAt = event.createdAt;
        step.status = "failed";
        step.retryCount = retryCount;
      }
    } else if (event.eventType === "loop_iteration_completed" && event.stepName) {
      const step = stepMap.get(event.stepName);
      if (step && event.data) {
        try {
          const parsed = JSON.parse(event.data) as Record<string, unknown>;
          if (typeof parsed.iteration === "number") {
            step.loopIteration = parsed.iteration;
          }
          if (typeof parsed.max_iterations === "number") {
            step.maxIterations = parsed.max_iterations;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  return stepOrder.map((stepName) => {
    const step = stepMap.get(stepName)!;
    let durationMs: number | null = null;
    if (step.completedAt) {
      durationMs = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
    }
    return {
      stepName,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      durationMs,
      loopIteration: step.loopIteration,
      maxIterations: step.maxIterations,
      retryCount: step.retryCount,
    };
  });
}

function extractToolName(event: WorkflowEvent): string {
  let toolName = event.stepName ?? "";
  if (!toolName && event.data) {
    try {
      const parsed = JSON.parse(event.data) as Record<string, unknown>;
      if (typeof parsed.tool_name === "string") toolName = parsed.tool_name;
      else if (typeof parsed.name === "string") toolName = parsed.name;
    } catch { /* ignore */ }
  }
  return toolName;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function extractFields(toolName: string, data: string | null): Array<{ key: string; value: string }> {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    const p = (parsed.tool_input && typeof parsed.tool_input === "object" && !Array.isArray(parsed.tool_input))
      ? parsed.tool_input as Record<string, unknown>
      : parsed;
    const lower = toolName.toLowerCase();
    const fields: Array<{ key: string; value: string }> = [];

    if (lower === "read") {
      const path = str(p.file_path ?? p.path);
      if (path) fields.push({ key: "path", value: path });
      if (typeof p.offset === "number") fields.push({ key: "offset", value: String(p.offset) });
      if (typeof p.limit === "number") fields.push({ key: "limit", value: String(p.limit) });
    } else if (lower === "write") {
      const path = str(p.file_path ?? p.path);
      if (path) fields.push({ key: "path", value: path });
    } else if (lower === "edit") {
      const path = str(p.file_path ?? p.path);
      if (path) fields.push({ key: "path", value: path });
      const old = str(p.old_string);
      if (old) fields.push({ key: "match", value: old.split("\n")[0] });
    } else if (lower === "bash") {
      const cmd = str(p.command);
      if (cmd) fields.push({ key: "cmd", value: cmd });
      if (p.run_in_background) fields.push({ key: "bg", value: "true" });
    } else if (lower === "grep") {
      const pattern = str(p.pattern);
      if (pattern) fields.push({ key: "pattern", value: pattern });
      const path = str(p.path);
      if (path) fields.push({ key: "in", value: path });
      const glob = str(p.glob);
      if (glob) fields.push({ key: "glob", value: glob });
    } else if (lower === "glob") {
      const pattern = str(p.pattern);
      if (pattern) fields.push({ key: "pattern", value: pattern });
      const path = str(p.path);
      if (path) fields.push({ key: "in", value: path });
    } else if (lower === "webfetch") {
      const url = str(p.url);
      if (url) fields.push({ key: "url", value: url });
    } else if (lower === "websearch") {
      const query = str(p.query);
      if (query) fields.push({ key: "query", value: query });
    } else if (lower === "agent") {
      const desc = str(p.description);
      if (desc) fields.push({ key: "task", value: desc });
      const prompt = str(p.prompt);
      if (prompt) fields.push({ key: "prompt", value: prompt.split("\n")[0] });
    } else {
      // Generic: first 3 short string/number values
      let count = 0;
      for (const [key, val] of Object.entries(p)) {
        if (count >= 3) break;
        if (typeof val === "string" && val.length > 0 && val.length < 300) {
          fields.push({ key, value: val });
          count++;
        } else if (typeof val === "number") {
          fields.push({ key, value: String(val) });
          count++;
        }
      }
    }

    return fields;
  } catch { /* ignore */ }
  return [];
}

export function buildToolCallLog(events: WorkflowEvent[]): ToolCallEntry[] {
  const toolEvents = events.filter(
    (e) => e.eventType === "tool_called" || e.eventType === "tool_completed" || e.eventType === "tool_failed"
  );

  // Pair tool_called with tool_completed/tool_failed by toolName (FIFO per name)
  const pending = new Map<string, Array<{ event: WorkflowEvent; index: number }>>();
  const entries: ToolCallEntry[] = [];

  for (const event of toolEvents) {
    const toolName = extractToolName(event);

    if (event.eventType === "tool_called") {
      const entry: ToolCallEntry = {
        toolName,
        fields: extractFields(toolName, event.data),
        durationMs: null,
        status: "running",
        createdAt: event.createdAt,
      };
      const idx = entries.push(entry) - 1;
      if (!pending.has(toolName)) pending.set(toolName, []);
      pending.get(toolName)!.push({ event, index: idx });
    } else {
      const queue = pending.get(toolName);
      if (queue && queue.length > 0) {
        const { event: callEvent, index } = queue.shift()!;
        const durationMs = new Date(event.createdAt).getTime() - new Date(callEvent.createdAt).getTime();
        entries[index] = {
          ...entries[index],
          durationMs,
          status: event.eventType === "tool_failed" ? "failed" : "completed",
        };
      }
    }
  }

  return entries.slice(-20);
}
