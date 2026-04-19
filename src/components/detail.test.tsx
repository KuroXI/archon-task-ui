import { describe, it, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { StepList } from "./StepList.js";
import { LogOutput } from "./LogOutput.js";
import { DetailPanel } from "./DetailPanel.js";
import type { StepSummary, ToolCallEntry, WorkflowRun, WorkflowEvent } from "../types.js";

function makeStep(overrides: Partial<StepSummary> = {}): StepSummary {
  return {
    stepName: "initialize",
    status: "completed",
    startedAt: "2020-01-01T00:00:00.000Z",
    completedAt: "2020-01-01T00:00:00.400Z",
    durationMs: 400,
    loopIteration: null,
    maxIterations: null,
    retryCount: null,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<ToolCallEntry> = {}): ToolCallEntry {
  return {
    toolName: "bash",
    fields: [{ key: "cmd", value: "ls" }],
    durationMs: 500,
    status: "completed",
    createdAt: "2020-01-01T00:00:01.000Z",
    ...overrides,
  };
}

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "r1",
    workflowName: "codegen",
    status: "running",
    workingPath: null,
    startedAt: "2020-01-01T00:00:00.000Z",
    branchName: "feat/test",
    elapsedSeconds: 222,
    ...overrides,
  };
}

describe("StepList", () => {
  it("renders STEPS heading", () => {
    const steps = [makeStep()];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("STEPS");
  });

  it("renders empty state", () => {
    const { lastFrame } = render(<StepList steps={[]} />);
    const frame = lastFrame() ?? "";
    expect(frame.toLowerCase()).toContain("no steps");
  });

  it("renders completed step with ✓ icon", () => {
    const steps = [makeStep({ status: "completed" })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("✓");
  });

  it("renders running step with ⟳ icon", () => {
    const steps = [makeStep({ status: "running", durationMs: null, completedAt: null })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("⟳");
  });

  it("renders failed step with ✗ icon", () => {
    const steps = [makeStep({ status: "failed" })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("✗");
  });

  it("renders cancelled step with ○ icon", () => {
    const steps = [makeStep({ status: "cancelled" })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("○");
  });

  it("renders duration in X.Xs format for sub-60s", () => {
    const steps = [makeStep({ durationMs: 400 })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("0.4s");
  });

  it("renders duration in Xm Ys format for >=60s", () => {
    const steps = [makeStep({ durationMs: 65000 })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("1m 5s");
  });

  it("renders no duration when durationMs is null", () => {
    const steps = [makeStep({ durationMs: null, completedAt: null, status: "running" })];
    const { lastFrame } = render(<StepList steps={steps} />);
    const frame = lastFrame() ?? "";
    // Should not contain any time pattern like "0.0s"
    expect(frame).not.toContain("0.0s");
  });

  it("renders iter N/M when loopIteration is positive", () => {
    const steps = [makeStep({ status: "running", durationMs: null, completedAt: null, loopIteration: 4, maxIterations: 60 })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("4/60");
  });

  it("does not render iter when loopIteration is null", () => {
    const steps = [makeStep({ loopIteration: null, maxIterations: null })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).not.toContain("iter");
  });

  it("renders retry when retryCount is positive", () => {
    const steps = [makeStep({ retryCount: 2 })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).toContain("retry 2");
  });

  it("does not render retry when retryCount is null", () => {
    const steps = [makeStep({ retryCount: null })];
    const { lastFrame } = render(<StepList steps={steps} />);
    expect(lastFrame()).not.toContain("retry");
  });

  it("renders mixed step statuses", () => {
    const steps = [
      makeStep({ stepName: "plan", status: "completed", durationMs: 2100 }),
      makeStep({ stepName: "build", status: "running", durationMs: null, completedAt: null }),
      makeStep({ stepName: "test", status: "failed", durationMs: 5000 }),
    ];
    const { lastFrame } = render(<StepList steps={steps} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("plan");
    expect(frame).toContain("build");
    expect(frame).toContain("test");
    expect(frame).toContain("✓");
    expect(frame).toContain("⟳");
    expect(frame).toContain("✗");
  });
});

describe("LogOutput", () => {
  it("renders TOOL CALLS heading", () => {
    const entries = [makeEntry()];
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />);
    expect(lastFrame()).toContain("TOOL CALLS");
  });

  it("renders empty state", () => {
    const { lastFrame } = render(<LogOutput entries={[]} scrollOffset={0} />);
    const frame = lastFrame() ?? "";
    expect(frame.toLowerCase()).toContain("no tool calls");
  });

  it("renders ✓ for completed entries", () => {
    const entries = [makeEntry({ status: "completed" })];
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />);
    expect(lastFrame()).toContain("✓");
  });

  it("renders ✗ for failed entries", () => {
    const entries = [makeEntry({ status: "failed" })];
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />);
    expect(lastFrame()).toContain("✗");
  });

  it("shows last 8 entries at scrollOffset=0 when more than 8 exist", () => {
    const entries: ToolCallEntry[] = [];
    for (let i = 0; i < 15; i++) {
      entries.push(makeEntry({ toolName: `tool-${i}`, createdAt: `2020-01-01T00:00:${String(i).padStart(2,"0")}.000Z` }));
    }
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />);
    const frame = lastFrame() ?? "";
    // Should show tools 7-14 (last 8)
    expect(frame).toContain("tool-14");
    expect(frame).toContain("tool-7");
    expect(frame).not.toContain("tool-6");
  });

  it("shows older entries when scrollOffset > 0", () => {
    const entries: ToolCallEntry[] = [];
    for (let i = 0; i < 15; i++) {
      entries.push(makeEntry({ toolName: `tool-${i}`, createdAt: `2020-01-01T00:00:${String(i).padStart(2,"0")}.000Z` }));
    }
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={3} />);
    const frame = lastFrame() ?? "";
    // endIndex = 15 - 3 = 12, startIndex = max(0, 12-8) = 4
    // Shows entries 4-11
    expect(frame).toContain("tool-11");
    expect(frame).toContain("tool-4");
    expect(frame).not.toContain("tool-12");
  });

  it("renders tool name in output", () => {
    const entries = [makeEntry({ toolName: "read_file" })];
    const { lastFrame } = render(<LogOutput entries={entries} scrollOffset={0} />);
    expect(lastFrame()).toContain("read_file");
  });
});

describe("DetailPanel", () => {
  it("renders 'Select a task.' when run is null", () => {
    const { lastFrame } = render(<DetailPanel run={null} events={[]} logScrollOffset={0} />);
    const frame = lastFrame() ?? "";
    expect(frame.toLowerCase()).toContain("select a task");
  });

  it("renders workflowName in title", () => {
    const run = makeRun({ workflowName: "my-workflow" });
    const { lastFrame } = render(<DetailPanel run={run} events={[]} logScrollOffset={0} />);
    expect(lastFrame()).toContain("my-workflow");
  });

  it("renders branchName in title", () => {
    const run = makeRun({ branchName: "feat/my-branch" });
    const { lastFrame } = render(<DetailPanel run={run} events={[]} logScrollOffset={0} />);
    expect(lastFrame()).toContain("feat/my-branch");
  });

  it("renders elapsed time in title", () => {
    const run = makeRun({ elapsedSeconds: 3 * 3600 + 42 * 60 + 7 });
    const { lastFrame } = render(<DetailPanel run={run} events={[]} logScrollOffset={0} />);
    expect(lastFrame()).toContain("03:42:07");
  });

  it("renders STEPS heading from StepList", () => {
    const run = makeRun();
    const { lastFrame } = render(<DetailPanel run={run} events={[]} logScrollOffset={0} />);
    expect(lastFrame()).toContain("STEPS");
  });

  it("renders TOOL CALLS heading from LogOutput", () => {
    const run = makeRun();
    const { lastFrame } = render(<DetailPanel run={run} events={[]} logScrollOffset={0} />);
    expect(lastFrame()).toContain("TOOL CALLS");
  });

  it("derives steps from events using buildStepSummaries", () => {
    const run = makeRun();
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
        eventType: "node_completed",
        stepName: "plan",
        data: null,
        createdAt: "2020-01-01T00:00:02.100Z",
      },
    ];
    const { lastFrame } = render(<DetailPanel run={run} events={events} logScrollOffset={0} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("plan");
    expect(frame).toContain("✓");
  });
});
