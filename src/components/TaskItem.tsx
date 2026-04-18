import React from "react";
import { Box, Text } from "ink";
import type { WorkflowRun } from "../types.js";

interface TaskItemProps {
  run: WorkflowRun;
  isSelected: boolean;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatusIcon(status: string): { icon: string; color: string } {
  switch (status) {
    case "running":
      return { icon: "⟳", color: "yellow" };
    case "completed":
      return { icon: "✓", color: "green" };
    case "failed":
      return { icon: "✗", color: "red" };
    case "cancelled":
      return { icon: "○", color: "grey" };
    default:
      return { icon: "?", color: "white" };
  }
}

export function TaskItem({ run, isSelected }: TaskItemProps): React.ReactElement {
  const { icon, color } = getStatusIcon(run.status);
  const prefix = isSelected ? "▶ " : "  ";
  const elapsed = formatElapsed(run.elapsedSeconds);
  const separator = "─".repeat(32);

  return (
    <Box flexDirection="column" width={32}>
      <Box flexDirection="row">
        <Text bold={isSelected}>{prefix}</Text>
        <Text color={color as Parameters<typeof Text>[0]["color"]}>{icon} </Text>
        <Text bold={isSelected} wrap="truncate">
          {run.workflowName}
        </Text>
        <Text color="grey">  {elapsed}</Text>
      </Box>
      <Box flexDirection="row">
        <Text>{"  "}</Text>
        <Text color="cyan" wrap="truncate">
          {run.branchName ?? "(no branch)"}
        </Text>
      </Box>
      <Text color="grey">{separator}</Text>
    </Box>
  );
}
