import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { WorkflowRun, WorkflowEvent, StepSummary, ToolCallEntry } from "../types.js";
import { buildStepSummaries, buildStepGroups, buildStepToolCallMap } from "../data/db.js";

const VISIBLE_STEPS = 12;
const VISIBLE_TOOL_CALLS = 8;

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
}

function formatMs(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function stepIcon(status: string): { icon: string; color: string } {
  switch (status) {
    case "running": return { icon: "⟳", color: "yellow" };
    case "completed": return { icon: "✓", color: "green" };
    case "failed": return { icon: "✗", color: "red" };
    default: return { icon: "○", color: "grey" };
  }
}

function parallelGroupStatus(steps: StepSummary[]): string {
  if (steps.some((s) => s.status === "running")) return "running";
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.every((s) => s.status === "completed")) return "completed";
  return "cancelled";
}

// Flat ordered list of all leaf steps (used for cursor navigation)
function flattenSteps(steps: ReturnType<typeof buildStepGroups>): StepSummary[] {
  const result: StepSummary[] = [];
  for (const group of steps) {
    if (group.type === "single") result.push(group.step);
    else result.push(...group.steps);
  }
  return result;
}


function ToolCallsPanel({ toolCalls, scroll }: { toolCalls: ToolCallEntry[]; scroll: number }): React.ReactElement {
  const visible = toolCalls.slice(scroll, scroll + VISIBLE_TOOL_CALLS);
  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      <Text bold>{"TOOL CALLS  (n/m)"}{toolCalls.length > VISIBLE_TOOL_CALLS ? `  ${scroll + 1}–${Math.min(scroll + VISIBLE_TOOL_CALLS, toolCalls.length)}/${toolCalls.length}` : ""}</Text>
      {toolCalls.length === 0 ? (
        <Text color="grey">No tool calls.</Text>
      ) : (
        visible.map((entry, i) => {
          const isRunning = entry.status === "running";
          const isFailed = entry.status === "failed";
          const icon = isRunning ? "⟳" : isFailed ? "✗" : "✓";
          const color = isRunning ? "yellow" : isFailed ? "red" : "green";
          const dur = formatMs(entry.durationMs);
          return (
            <Box key={`${entry.createdAt}-${scroll + i}`} flexDirection="column">
              <Box flexDirection="row" gap={1}>
                <Text color={color as Parameters<typeof Text>[0]["color"]}>{icon}</Text>
                <Text bold>{entry.toolName}</Text>
                {dur ? <Text color="grey">{dur}</Text> : null}
              </Box>
              {entry.fields.map((f) => (
                <Box key={f.key} flexDirection="row" paddingLeft={2} gap={1}>
                  <Text color="grey">{f.key}:</Text>
                  <Text color="cyan" wrap="truncate">{f.value}</Text>
                </Box>
              ))}
            </Box>
          );
        })
      )}
    </Box>
  );
}

interface DetailPanelProps {
  run: WorkflowRun | null;
  events: WorkflowEvent[];
}

export function DetailPanel({ run, events }: DetailPanelProps): React.ReactElement {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepScroll, setStepScroll] = useState(0);
  const [toolCallScroll, setToolCallScroll] = useState(0);

  const steps = run ? buildStepSummaries(events) : [];
  const groups = buildStepGroups(steps);
  const flatSteps = flattenSteps(groups);
  const toolCallMap = run ? buildStepToolCallMap(events) : new Map<string, ToolCallEntry[]>();

  // Clamp stepIndex when steps change (e.g. new step arrives)
  useEffect(() => {
    if (flatSteps.length === 0) {
      setStepIndex(0);
      setStepScroll(0);
    } else {
      setStepIndex((prev) => Math.min(prev, flatSteps.length - 1));
    }
  }, [flatSteps.length]);

  // Keep scroll window around cursor
  useEffect(() => {
    setStepScroll((prev) => {
      if (stepIndex < prev) return stepIndex;
      if (stepIndex >= prev + VISIBLE_STEPS) return stepIndex - VISIBLE_STEPS + 1;
      return prev;
    });
  }, [stepIndex]);

  const selectedStep = flatSteps[stepIndex] ?? null;
  const selectedToolCalls = selectedStep ? (toolCallMap.get(selectedStep.stepName) ?? []) : [];

  useEffect(() => {
    setToolCallScroll(0);
  }, [stepIndex]);

  useInput((input, key) => {
    if (!run) return;
    if (input === "j") setStepIndex((prev) => Math.min(Math.max(0, flatSteps.length - 1), prev + 1));
    if (input === "k") setStepIndex((prev) => Math.max(0, prev - 1));
    if (input === "n") setToolCallScroll((prev) => Math.max(0, prev - 1));
    if (input === "m") setToolCallScroll((prev) => {
      const maxScroll = Math.max(0, selectedToolCalls.length - VISIBLE_TOOL_CALLS);
      return Math.min(maxScroll, prev + 1);
    });
  }, { isActive: process.stdin.isTTY ?? false });

  if (!run) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text color="grey">Select a task.</Text>
      </Box>
    );
  }

  const elapsed = formatElapsed(run.elapsedSeconds);
  const branchDisplay = run.branchName ?? "(no branch)";

  // Build visible step rows with cursor tracking
  // We render group-aware rows but track a flat index for the cursor
  let flatIdx = -1;

  const visibleRows: React.ReactElement[] = [];
  for (const group of groups) {
    if (group.type === "single") {
      flatIdx++;
      const rowFlatIdx = flatIdx;
      if (rowFlatIdx < stepScroll || rowFlatIdx >= stepScroll + VISIBLE_STEPS) continue;

      const step = group.step;
      const { icon, color } = stepIcon(step.status);
      const isRunning = step.status === "running";
      const duration = formatDuration(step.durationMs);
      const isSelected = rowFlatIdx === stepIndex;
      const iterLabel =
        step.loopIteration !== null && step.loopIteration > 0 && step.maxIterations !== null
          ? ` iter ${step.loopIteration}/${step.maxIterations}`
          : "";
      const retryLabel =
        step.retryCount !== null && step.retryCount > 0 ? ` retry ${step.retryCount}` : "";

      visibleRows.push(
        <Box key={step.stepName} flexDirection="row" gap={1}>
          <Text color="cyan">{isSelected ? "▶" : " "}</Text>
          <Text color={color as Parameters<typeof Text>[0]["color"]}>{icon}</Text>
          <Text color={isRunning ? "cyan" : undefined} bold={isSelected || isRunning}>
            {step.stepName}{iterLabel}{retryLabel}
          </Text>
          {duration ? <Text color="grey">{duration}</Text> : null}
        </Box>
      );
    } else {
      // Parallel group header (not selectable, rendered if any sub-step is visible)
      const groupStatus = parallelGroupStatus(group.steps);
      const { icon, color } = stepIcon(groupStatus);
      const firstSubIdx = flatIdx + 1;
      const lastSubIdx = flatIdx + group.steps.length;
      const anyVisible =
        lastSubIdx >= stepScroll && firstSubIdx < stepScroll + VISIBLE_STEPS;

      if (anyVisible) {
        visibleRows.push(
          <Box key={`parallel-header-${firstSubIdx}`} flexDirection="row" gap={1}>
            <Text>{"  "}</Text>
            <Text color={color as Parameters<typeof Text>[0]["color"]}>{icon}</Text>
            <Text color="cyan" bold>[ parallel ({group.steps.length}) ]</Text>
          </Box>
        );
      }

      for (const step of group.steps) {
        flatIdx++;
        const rowFlatIdx = flatIdx;
        if (rowFlatIdx < stepScroll || rowFlatIdx >= stepScroll + VISIBLE_STEPS) continue;

        const { icon: sIcon, color: sColor } = stepIcon(step.status);
        const isRunning = step.status === "running";
        const duration = formatDuration(step.durationMs);
        const isSelected = rowFlatIdx === stepIndex;
        const iterLabel =
          step.loopIteration !== null && step.loopIteration > 0 && step.maxIterations !== null
            ? ` iter ${step.loopIteration}/${step.maxIterations}`
            : "";
        const retryLabel =
          step.retryCount !== null && step.retryCount > 0 ? ` retry ${step.retryCount}` : "";

        visibleRows.push(
          <Box key={step.stepName} flexDirection="row" gap={1} paddingLeft={2}>
            <Text color="cyan">{isSelected ? "▶" : " "}</Text>
            <Text color={sColor as Parameters<typeof Text>[0]["color"]}>{sIcon}</Text>
            <Text color={isRunning ? "cyan" : undefined} bold={isSelected || isRunning}>
              {step.stepName}{iterLabel}{retryLabel}
            </Text>
            {duration ? <Text color="grey">{duration}</Text> : null}
          </Box>
        );
      }
    }
  }

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {/* Title bar */}
      <Box flexDirection="row" gap={1}>
        <Text color="grey">{run.id}</Text>
        <Text bold>{run.workflowName}</Text>
        <Text color="grey">·</Text>
        <Text color="cyan">{branchDisplay}</Text>
        <Text color="grey">·</Text>
        <Text color="grey">{elapsed}</Text>
      </Box>

      {/* Two-panel body */}
      <Box flexDirection="row" flexGrow={1} gap={2}>
        {/* Steps panel */}
        <Box flexDirection="column" flexShrink={0}>
          <Text bold>{"STEPS  (j/k)"}</Text>
          {visibleRows.length === 0 ? (
            <Text color="grey">No steps recorded yet.</Text>
          ) : (
            visibleRows
          )}
          {flatSteps.length > VISIBLE_STEPS && (
            <Text color="grey">
              {stepScroll + 1}–{Math.min(stepScroll + VISIBLE_STEPS, flatSteps.length)}/{flatSteps.length}
            </Text>
          )}
        </Box>

        <Text color="grey">│</Text>

        {/* Tool calls panel */}
        <ToolCallsPanel toolCalls={selectedToolCalls} scroll={toolCallScroll} />
      </Box>
    </Box>
  );
}
