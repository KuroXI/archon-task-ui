import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  fetchWorkflowRuns,
  fetchWorkflowEvents,
  buildStepSummaries,
  buildToolCallLog,
} from "./db.js";
import type { WorkflowEvent } from "../types.js";

function createSchema(db: Database): void {
  db.exec(`
    CREATE TABLE remote_agent_workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_name TEXT NOT NULL,
      status TEXT NOT NULL,
      working_path TEXT,
      started_at TEXT NOT NULL
    );

    CREATE TABLE remote_agent_workflow_events (
      id TEXT PRIMARY KEY,
      workflow_run_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      step_name TEXT,
      data TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE remote_agent_isolation_environments (
      workflow_id TEXT PRIMARY KEY,
      branch_name TEXT NOT NULL
    );
  `);
}

describe("fetchWorkflowRuns", () => {
  it("returns correct shape with branch name and elapsed seconds", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES
        ('run-1', 'archon-codegen', 'running', '/work', '2020-01-01T00:00:00.000Z');
      INSERT INTO remote_agent_isolation_environments VALUES
        ('run-1', 'feat/codegen');
    `);

    const runs = fetchWorkflowRuns(db);
    expect(runs).toHaveLength(1);

    const run = runs[0];
    expect(run.id).toBe("run-1");
    expect(run.workflowName).toBe("codegen"); // archon- prefix stripped
    expect(run.status).toBe("running");
    expect(run.branchName).toBe("feat/codegen");
    expect(typeof run.elapsedSeconds).toBe("number");
    expect(run.elapsedSeconds).toBeGreaterThan(0);
  });

  it("returns null branchName when no isolation environment row", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES
        ('run-2', 'archon-lint', 'running', null, '2020-01-01T00:00:00.000Z');
    `);

    const runs = fetchWorkflowRuns(db);
    expect(runs).toHaveLength(1);
    expect(runs[0].branchName).toBeNull();
  });

  it("orders running first, then by started_at DESC", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES
        ('run-a', 'archon-old', 'completed', null, '2020-01-01T00:00:00.000Z'),
        ('run-b', 'archon-newer', 'completed', null, '2020-06-01T00:00:00.000Z'),
        ('run-c', 'archon-running', 'running', null, '2020-03-01T00:00:00.000Z');
    `);

    const runs = fetchWorkflowRuns(db);
    expect(runs[0].id).toBe("run-c");
    expect(runs[1].id).toBe("run-b");
    expect(runs[2].id).toBe("run-a");
  });

  it("returns all statuses", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES
        ('run-s', 'archon-foo', 'stopped', null, '2020-01-01T00:00:00.000Z'),
        ('run-c', 'archon-baz', 'completed', null, '2020-01-02T00:00:00.000Z'),
        ('run-x', 'archon-qux', 'cancelled', null, '2020-01-03T00:00:00.000Z'),
        ('run-fail', 'archon-quux', 'failed', null, '2020-01-04T00:00:00.000Z'),
        ('run-r', 'archon-run', 'running', null, '2020-01-05T00:00:00.000Z');
    `);

    const runs = fetchWorkflowRuns(db);
    expect(runs).toHaveLength(5);
    expect(runs[0].id).toBe("run-r"); // running first
  });

  it("uses last event time as elapsed for non-running tasks", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES
        ('run-done', 'archon-foo', 'completed', null, '2020-01-01T00:00:00.000Z');
      INSERT INTO remote_agent_workflow_events VALUES
        ('evt-1', 'run-done', 'step_completed', 'plan', null, '2020-01-01T00:01:00.000Z'),
        ('evt-2', 'run-done', 'step_completed', 'report', null, '2020-01-01T00:02:00.000Z');
    `);

    const runs = fetchWorkflowRuns(db);
    expect(runs[0].elapsedSeconds).toBe(120); // 2 minutes exactly
  });

  it("does not strip prefix when workflow_name does not start with archon-", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES
        ('run-3', 'my-workflow', 'running', null, '2020-01-01T00:00:00.000Z');
    `);

    const runs = fetchWorkflowRuns(db);
    expect(runs[0].workflowName).toBe("my-workflow");
  });
});

describe("fetchWorkflowEvents", () => {
  it("returns events ordered by created_at ASC", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES ('run-1', 'archon-x', 'running', null, '2020-01-01T00:00:00.000Z');
      INSERT INTO remote_agent_workflow_events VALUES
        ('evt-2', 'run-1', 'node_started', 'step2', null, '2020-01-01T00:00:02.000Z'),
        ('evt-1', 'run-1', 'node_started', 'step1', null, '2020-01-01T00:00:01.000Z'),
        ('evt-3', 'run-1', 'node_completed', 'step1', null, '2020-01-01T00:00:03.000Z');
    `);

    const events = fetchWorkflowEvents(db, "run-1");
    expect(events).toHaveLength(3);
    expect(events[0].createdAt).toBe("2020-01-01T00:00:01.000Z");
    expect(events[1].createdAt).toBe("2020-01-01T00:00:02.000Z");
    expect(events[2].createdAt).toBe("2020-01-01T00:00:03.000Z");
  });

  it("returns empty array when runId has no events", () => {
    const db = new Database(":memory:");
    createSchema(db);

    const events = fetchWorkflowEvents(db, "nonexistent-run");
    expect(events).toHaveLength(0);
  });

  it("returns correct WorkflowEvent shape", () => {
    const db = new Database(":memory:");
    createSchema(db);

    db.exec(`
      INSERT INTO remote_agent_workflow_runs VALUES ('run-1', 'archon-x', 'running', null, '2020-01-01T00:00:00.000Z');
      INSERT INTO remote_agent_workflow_events VALUES
        ('evt-1', 'run-1', 'tool_called', 'bash', '{"cmd":"ls"}', '2020-01-01T00:00:01.000Z');
    `);

    const events = fetchWorkflowEvents(db, "run-1");
    expect(events[0].id).toBe("evt-1");
    expect(events[0].workflowRunId).toBe("run-1");
    expect(events[0].eventType).toBe("tool_called");
    expect(events[0].stepName).toBe("bash");
    expect(events[0].data).toBe('{"cmd":"ls"}');
  });
});

describe("buildStepSummaries", () => {
  it("builds completed step with duration", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "initialize",
        data: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        workflowRunId: "r1",
        eventType: "node_completed",
        stepName: "initialize",
        data: null,
        createdAt: "2020-01-01T00:00:01.000Z",
      },
    ];

    const steps = buildStepSummaries(events);
    expect(steps).toHaveLength(1);
    expect(steps[0].stepName).toBe("initialize");
    expect(steps[0].status).toBe("completed");
    expect(steps[0].durationMs).toBe(1000);
    expect(steps[0].completedAt).toBe("2020-01-01T00:00:01.000Z");
  });

  it("builds running step (no completion event)", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "implement",
        data: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ];

    const steps = buildStepSummaries(events);
    expect(steps[0].status).toBe("running");
    expect(steps[0].durationMs).toBeNull();
    expect(steps[0].completedAt).toBeNull();
  });

  it("builds failed step", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "validate",
        data: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        workflowRunId: "r1",
        eventType: "node_failed",
        stepName: "validate",
        data: null,
        createdAt: "2020-01-01T00:00:05.000Z",
      },
    ];

    const steps = buildStepSummaries(events);
    expect(steps[0].status).toBe("failed");
    expect(steps[0].durationMs).toBe(5000);
  });

  it("parses loop iteration metadata", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "implement",
        data: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        workflowRunId: "r1",
        eventType: "loop_iteration_completed",
        stepName: "implement",
        data: JSON.stringify({ iteration: 4, max_iterations: 60 }),
        createdAt: "2020-01-01T00:00:10.000Z",
      },
    ];

    const steps = buildStepSummaries(events);
    expect(steps[0].loopIteration).toBe(4);
    expect(steps[0].maxIterations).toBe(60);
  });

  it("parses retry count from node event data", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "build",
        data: JSON.stringify({ retry_count: 2 }),
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ];

    const steps = buildStepSummaries(events);
    expect(steps[0].retryCount).toBe(2);
  });

  it("preserves step order by first appearance", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "plan",
        data: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "implement",
        data: null,
        createdAt: "2020-01-01T00:00:01.000Z",
      },
      {
        id: "e3",
        workflowRunId: "r1",
        eventType: "node_completed",
        stepName: "plan",
        data: null,
        createdAt: "2020-01-01T00:00:02.000Z",
      },
    ];

    const steps = buildStepSummaries(events);
    expect(steps[0].stepName).toBe("plan");
    expect(steps[1].stepName).toBe("implement");
  });
});

describe("buildToolCallLog", () => {
  it("returns only tool_called and tool_completed events", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "step1",
        data: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        workflowRunId: "r1",
        eventType: "tool_called",
        stepName: "bash",
        data: '{"cmd":"ls"}',
        createdAt: "2020-01-01T00:00:01.000Z",
      },
      {
        id: "e3",
        workflowRunId: "r1",
        eventType: "tool_completed",
        stepName: "bash",
        data: '{"exit_code":0}',
        createdAt: "2020-01-01T00:00:02.000Z",
      },
    ];

    // tool_called + tool_completed pair = 1 entry
    const log = buildToolCallLog(events);
    expect(log).toHaveLength(1);
    expect(log[0].toolName).toBe("bash");
    expect(log[0].status).toBe("completed");
    expect(log[0].durationMs).toBe(1000);
  });

  it("caps at 20 entries when more than 20 tool_called events exist", () => {
    const events: WorkflowEvent[] = [];
    for (let i = 0; i < 30; i++) {
      events.push({
        id: `e${i}`,
        workflowRunId: "r1",
        eventType: "tool_called",
        stepName: "bash",
        data: null,
        createdAt: `2020-01-01T00:${String(i).padStart(2, "0")}:00.000Z`,
      });
    }

    const log = buildToolCallLog(events);
    expect(log).toHaveLength(20);
    expect(log[0].createdAt).toBe("2020-01-01T00:10:00.000Z");
    expect(log[19].createdAt).toBe("2020-01-01T00:29:00.000Z");
  });

  it("returns empty array when no tool events", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "node_started",
        stepName: "step1",
        data: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ];

    const log = buildToolCallLog(events);
    expect(log).toHaveLength(0);
  });

  it("returns correct ToolCallEntry shape", () => {
    const events: WorkflowEvent[] = [
      {
        id: "e1",
        workflowRunId: "r1",
        eventType: "tool_called",
        stepName: "read_file",
        data: '{"path":"src/main.ts"}',
        createdAt: "2020-01-01T00:00:01.000Z",
      },
    ];

    const log = buildToolCallLog(events);
    expect(log[0].toolName).toBe("read_file");
    expect(log[0].status).toBe("running");
    expect(log[0].durationMs).toBeNull();
    expect(log[0].createdAt).toBe("2020-01-01T00:00:01.000Z");
    expect(log[0].fields).toEqual([{ key: "path", value: "src/main.ts" }]);
  });
});
