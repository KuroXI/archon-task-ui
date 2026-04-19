import React from "react";
import { Box, Text } from "ink";
import type { ToolCallEntry } from "../types.js";

interface LogOutputProps {
  entries: ToolCallEntry[];
  scrollOffset: number;
}

const VISIBLE_ENTRIES = 8;

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export function LogOutput({ entries, scrollOffset }: LogOutputProps): React.ReactElement {
  const heading = <Text bold>{"TOOL CALLS  (j/k scroll)"}</Text>;

  if (entries.length === 0) {
    return (
      <Box flexDirection="column">
        {heading}
        <Text color="grey">No tool calls yet.</Text>
      </Box>
    );
  }

  const endIndex = entries.length - scrollOffset;
  const startIndex = Math.max(0, endIndex - VISIBLE_ENTRIES);
  const visible = entries.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column">
      {heading}
      {visible.map((entry, i) => {
        const isRunning = entry.status === "running";
        const isFailed = entry.status === "failed";

        const statusIcon = isRunning ? "⟳" : isFailed ? "✗" : "✓";
        const iconColor = isRunning ? "yellow" : isFailed ? "red" : "green";
        const duration = formatDuration(entry.durationMs);

        return (
          <Box key={`${entry.createdAt}-${i}`} flexDirection="column" marginBottom={0}>
            <Box flexDirection="row" gap={1}>
              <Text color={iconColor as Parameters<typeof Text>[0]["color"]}>{statusIcon}</Text>
              <Text bold>{entry.toolName}</Text>
              {duration ? <Text color="grey">{duration}</Text> : null}
            </Box>
            {entry.fields.map((f) => (
              <Box key={f.key} flexDirection="row" gap={1} paddingLeft={2}>
                <Text color="grey">{f.key}:</Text>
                <Text color="cyan" wrap="truncate">
                  {truncate(f.value, 80)}
                </Text>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
