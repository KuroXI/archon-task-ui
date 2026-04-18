import React from "react";
import { Box, Text } from "ink";
import type { WorkflowRun, WorkflowEvent } from "../types.js";
import { buildStepSummaries, buildToolCallLog } from "../data/db.js";
import { StepList } from "./StepList.js";
import { LogOutput } from "./LogOutput.js";

interface DetailPanelProps {
  run: WorkflowRun | null;
  events: WorkflowEvent[];
  logScrollOffset: number;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DetailPanel({ run, events, logScrollOffset }: DetailPanelProps): React.ReactElement {
  if (!run) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <Text color="grey">Select a task.</Text>
      </Box>
    );
  }

  const steps = buildStepSummaries(events);
  const toolLog = buildToolCallLog(events);
  const elapsed = formatElapsed(run.elapsedSeconds);
  const branchDisplay = run.branchName ?? "(no branch)";

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold>{run.workflowName}</Text>
        <Text color="grey">·</Text>
        <Text color="cyan">{branchDisplay}</Text>
        <Text color="grey">·</Text>
        <Text color="grey">{elapsed}</Text>
      </Box>
      <StepList steps={steps} />
      <LogOutput entries={toolLog} scrollOffset={logScrollOffset} />
    </Box>
  );
}
