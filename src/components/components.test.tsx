import { describe, it, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { Header } from "./Header.js";
import { TaskItem } from "./TaskItem.js";
import { TaskList } from "./TaskList.js";
import type { WorkflowRun } from "../types.js";

const makeRun = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: "run-1",
  workflowName: "codegen",
  status: "running",
  workingPath: "/work",
  startedAt: new Date(Date.now() - 222000).toISOString(),
  branchName: "feat/codegen",
  elapsedSeconds: 222,
  ...overrides,
});

describe("Header", () => {
  it("renders ARCHON TASK UI text", () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain("ARCHON TASK UI");
  });

  it("renders keyboard hints for refresh", () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain("[r]");
  });

  it("renders keyboard hint for quit", () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain("[q]");
  });

  it("renders navigation hint", () => {
    const { lastFrame } = render(<Header />);
    const frame = lastFrame() ?? "";
    expect(frame.includes("[↑↓]") || frame.includes("↑") || frame.includes("select")).toBe(true);
  });
});

describe("TaskItem", () => {
  it("renders running status with ⟳ icon", () => {
    const run = makeRun({ status: "running" });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("⟳");
  });

  it("renders completed status with ✓ icon", () => {
    const run = makeRun({ status: "completed", elapsedSeconds: 600 });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("✓");
  });

  it("renders failed status with ✗ icon", () => {
    const run = makeRun({ status: "failed", elapsedSeconds: 30 });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("✗");
  });

  it("renders cancelled status with ○ icon", () => {
    const run = makeRun({ status: "cancelled", elapsedSeconds: 120 });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("○");
  });

  it("renders ▶ prefix when selected", () => {
    const run = makeRun();
    const { lastFrame } = render(<TaskItem run={run} isSelected={true} />);
    expect(lastFrame()).toContain("▶");
  });

  it("does not render ▶ when not selected", () => {
    const run = makeRun();
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).not.toContain("▶");
  });

  it("renders the task workflowName", () => {
    const run = makeRun({ workflowName: "my-task" });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("my-task");
  });

  it("renders branch name on second line", () => {
    const run = makeRun({ branchName: "feat/my-feature" });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("feat/my-feature");
  });

  it("renders (no branch) when branchName is null", () => {
    const run = makeRun({ branchName: null });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("(no branch)");
  });

  it("renders elapsed time in HH:MM:SS format", () => {
    const run = makeRun({ elapsedSeconds: 3 * 3600 + 42 * 60 + 7 });
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    expect(lastFrame()).toContain("03:42:07");
  });

  it("renders separator line", () => {
    const run = makeRun();
    const { lastFrame } = render(<TaskItem run={run} isSelected={false} />);
    const frame = lastFrame() ?? "";
    expect(frame.includes("─") || frame.includes("-")).toBe(true);
  });
});

describe("TaskList", () => {
  it("renders 'No tasks found.' for empty runs array", () => {
    const { lastFrame } = render(<TaskList runs={[]} selectedIndex={0} />);
    const frame = lastFrame() ?? "";
    expect(frame.toLowerCase()).toContain("no tasks found");
  });

  it("renders task names for non-empty runs", () => {
    const runs = [
      makeRun({ id: "r1", workflowName: "alpha" }),
      makeRun({ id: "r2", workflowName: "beta", status: "completed" }),
    ];
    const { lastFrame } = render(<TaskList runs={runs} selectedIndex={0} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("alpha");
    expect(frame).toContain("beta");
  });

  it("renders ▶ on the selected task", () => {
    const runs = [
      makeRun({ id: "r1", workflowName: "first" }),
      makeRun({ id: "r2", workflowName: "second", status: "completed" }),
    ];
    const { lastFrame } = render(<TaskList runs={runs} selectedIndex={1} />);
    expect(lastFrame()).toContain("▶");
  });
});
