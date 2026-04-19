import React from "react";
import { Box, Text } from "ink";

export type TabFilter = "all" | "running" | "failed" | "completed" | "cancelled";

export const TABS: TabFilter[] = ["all", "running", "failed", "completed", "cancelled"];

interface TabBarProps {
  activeTab: TabFilter;
}

export function TabBar({ activeTab }: TabBarProps): React.ReactElement {
  return (
    <Box flexDirection="row" paddingX={1} gap={1}>
      {TABS.map((tab) => {
        const active = tab === activeTab;
        return (
          <Box key={tab} paddingX={1} backgroundColor={active ? "blue" : undefined}>
            <Text bold={active} color={active ? "white" : "grey"}>
              {tab.toUpperCase()}
            </Text>
          </Box>
        );
      })}
      <Box flexGrow={1} />
      <Text color="grey">[tab] switch</Text>
    </Box>
  );
}
