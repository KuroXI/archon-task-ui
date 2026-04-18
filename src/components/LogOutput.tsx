import React from "react";
import { Box, Text } from "ink";
import type { ToolCallEntry } from "../types.js";

interface LogOutputProps {
  entries: ToolCallEntry[];
  scrollOffset: number;
}

const VISIBLE_LINES = 12;

export function LogOutput({ entries, scrollOffset }: LogOutputProps): React.ReactElement {
  const heading = (
    <Text bold>{"TOOL CALLS  (j/k scroll)"}</Text>
  );

  if (entries.length === 0) {
    return (
      <Box flexDirection="column">
        {heading}
        <Text color="grey">No tool calls yet.</Text>
      </Box>
    );
  }

  // Calculate the visible slice
  // scrollOffset=0 shows last 12; scrollOffset=N shows 12 entries ending at entries.length - N
  const endIndex = entries.length - scrollOffset;
  const startIndex = Math.max(0, endIndex - VISIBLE_LINES);
  const visible = entries.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column">
      {heading}
      {visible.map((entry, i) => {
        const isToolCalled = entry.eventType === "tool_called";
        const arrow = isToolCalled ? "→" : "←";
        const color = isToolCalled ? "yellow" : "green";

        // Format the data as a single-line JSON string, truncated
        let dataStr = "";
        if (entry.data) {
          try {
            dataStr = JSON.stringify(JSON.parse(entry.data));
          } catch {
            dataStr = entry.data;
          }
        }

        return (
          <Box key={`${entry.createdAt}-${i}`} flexDirection="row" gap={1}>
            <Text color={color as Parameters<typeof Text>[0]["color"]}>
              {arrow} {entry.eventType}
            </Text>
            <Text color={color as Parameters<typeof Text>[0]["color"]} wrap="truncate">
              {entry.toolName}
            </Text>
            {dataStr ? (
              <Text color="grey" wrap="truncate">
                {dataStr}
              </Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
