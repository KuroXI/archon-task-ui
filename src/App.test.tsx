import { describe, it, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "./components/App.js";

describe("App integration smoke test", () => {
  it("renders header text with :memory: DB", () => {
    const { lastFrame } = render(<App dbPath=":memory:" />);
    expect(lastFrame()).toContain("ARCHON TASK UI");
  });

  it("renders 'No tasks found.' with empty :memory: DB", () => {
    const { lastFrame } = render(<App dbPath=":memory:" />);
    const frame = lastFrame() ?? "";
    expect(frame.toLowerCase()).toContain("no tasks found");
  });

  it("renders keyboard hints in header", () => {
    const { lastFrame } = render(<App dbPath=":memory:" />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("[r]");
    expect(frame).toContain("[q]");
  });

  it("renders without crashing — no unhandled errors", () => {
    // If this test runs without throwing, the app initializes successfully
    expect(() => {
      render(<App dbPath=":memory:" />);
    }).not.toThrow();
  });

  it("renders the panel divider '│'", () => {
    const { lastFrame } = render(<App dbPath=":memory:" />);
    expect(lastFrame()).toContain("│");
  });

  it("renders 'Select a task.' in detail panel with no tasks", () => {
    const { lastFrame } = render(<App dbPath=":memory:" />);
    const frame = lastFrame() ?? "";
    // With empty task list, detail panel shows "Select a task." or "No tasks found."
    // The task list shows "No tasks found." and detail panel shows "Select a task."
    expect(frame.toLowerCase()).toContain("select a task");
  });
});
