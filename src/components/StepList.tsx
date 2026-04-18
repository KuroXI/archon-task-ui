import React from "react";
import { Box, Text } from "ink";
import type { StepSummary } from "../types.js";

interface StepListProps {
  steps: StepSummary[];
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "";
  const totalSeconds = durationMs / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

function getStepIconAndColor(status: string): { icon: string; color: string } {
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
      return { icon: "○", color: "grey" };
  }
}

export function StepList({ steps }: StepListProps): React.ReactElement {
  if (steps.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>STEPS</Text>
        <Text color="grey">No steps recorded yet.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>STEPS</Text>
      {steps.map((step) => {
        const { icon, color } = getStepIconAndColor(step.status);
        const duration = formatDuration(step.durationMs);
        const isRunning = step.status === "running";

        const showIter =
          step.loopIteration !== null &&
          step.loopIteration > 0 &&
          step.maxIterations !== null;
        const showRetry = step.retryCount !== null && step.retryCount > 0;

        return (
          <Box key={step.stepName} flexDirection="row" gap={1}>
            <Text color={color as Parameters<typeof Text>[0]["color"]}>{icon}</Text>
            <Text
              color={isRunning ? "cyan" : undefined}
              bold={isRunning}
              wrap="truncate"
            >
              {step.stepName}
            </Text>
            {duration ? <Text color="grey">{duration}</Text> : null}
            {showIter ? (
              <Text color="grey">
                iter {step.loopIteration}/{step.maxIterations}
              </Text>
            ) : null}
            {showRetry ? (
              <Text color="grey">retry {step.retryCount}</Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
