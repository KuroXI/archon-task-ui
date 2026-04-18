import React from "react";
import { Box, Text } from "ink";
import type { WorkflowRun } from "../types.js";
import { TaskItem } from "./TaskItem.js";

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

  return (
    <Box width={32} flexDirection="column">
      {runs.map((run, index) => (
        <TaskItem key={run.id} run={run} isSelected={index === selectedIndex} />
      ))}
    </Box>
  );
}
