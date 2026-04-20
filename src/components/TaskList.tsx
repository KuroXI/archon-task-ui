import React from "react";
import { Box, Text } from "ink";
import type { WorkflowRun } from "../types.js";
import { TaskItem } from "./TaskItem.js";

const ITEM_HEIGHT = 3; // rows per TaskItem (2 content + 1 separator)
const RESERVED_ROWS = 3; // header + tabbar + some padding

interface TaskListProps {
  runs: WorkflowRun[];
  selectedIndex: number;
}

export function TaskList({ runs, selectedIndex }: TaskListProps): React.ReactElement {
  if (runs.length === 0) {
    return (
      <Box width={32} flexDirection="column" paddingX={1}>
        <Text color="grey">No tasks found.</Text>
      </Box>
    );
  }

  const terminalRows = process.stdout.rows ?? 24;
  const maxVisible = Math.max(1, Math.floor((terminalRows - RESERVED_ROWS) / ITEM_HEIGHT));
  const halfWindow = Math.floor(maxVisible / 2);
  const start = Math.max(0, Math.min(selectedIndex - halfWindow, runs.length - maxVisible));
  const visibleRuns = runs.slice(start, start + maxVisible);

  return (
    <Box width={32} flexDirection="column">
      {visibleRuns.map((run, i) => (
        <TaskItem key={run.id} run={run} isSelected={start + i === selectedIndex} />
      ))}
    </Box>
  );
}
