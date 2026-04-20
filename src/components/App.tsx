import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { useArchonTasks } from "../hooks/useArchonTasks.js";
import { useUpdateCheck } from "../hooks/useUpdateCheck.js";
import { Header } from "./Header.js";
import { TabBar, TABS } from "./TabBar.js";
import type { TabFilter } from "./TabBar.js";
import { TaskList } from "./TaskList.js";
import { DetailPanel } from "./DetailPanel.js";
import { openDb, fetchWorkflowEvents } from "../data/db.js";
import type { WorkflowEvent } from "../types.js";
import type { Database } from "bun:sqlite";

interface AppProps {
  dbPath?: string;
}

export function App({ dbPath }: AppProps): React.ReactElement {
  const { runs, selectedIndex, setSelectedIndex, refresh, error } = useArchonTasks(dbPath);
  const updateAvailable = useUpdateCheck();
  const [activeTab, setActiveTab] = useState<TabFilter>("running");

  const filteredRuns = activeTab === "all"
    ? runs
    : runs.filter((r) => r.status === activeTab);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const eventsDbRef = useRef<Database | null>(null);

  // Open a separate read-only DB connection for fetching events
  useEffect(() => {
    if (error) return;
    let db: Database | null = null;
    try {
      db = openDb(dbPath);
      eventsDbRef.current = db;
    } catch {
      // If DB fails to open, the hook's error state will handle it
    }
    return () => {
      db?.close();
      eventsDbRef.current = null;
    };
  }, [dbPath, error]);

  // Fetch events for the selected run
  const selectedRun = filteredRuns[selectedIndex] ?? null;
  useEffect(() => {
    if (!selectedRun || !eventsDbRef.current) {
      setEvents([]);
      return;
    }

    try {
      const fetched = fetchWorkflowEvents(eventsDbRef.current, selectedRun.id);
      setEvents(fetched);
    } catch {
      setEvents([]);
    }
  }, [selectedRun?.id]);

  // Also refresh events when runs refresh (auto-poll)
  useEffect(() => {
    if (!selectedRun || !eventsDbRef.current) return;
    try {
      const fetched = fetchWorkflowEvents(eventsDbRef.current, selectedRun.id);
      setEvents(fetched);
    } catch {
      // silently ignore
    }
  }, [runs]);

  // Keyboard handling — only active when stdin is a TTY (not in tests)
  useInput((input, key) => {
    if (key.tab) {
      const current = TABS.indexOf(activeTab);
      setActiveTab(TABS[(current + 1) % TABS.length]);
      setSelectedIndex(0);
    } else if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(filteredRuns.length - 1, selectedIndex + 1));
    } else if (input === "r") {
      refresh();
    } else if (input === "q") {
      process.exit(0);
    }
  }, { isActive: process.stdin.isTTY ?? false });

  if (error) {
    return (
      <Box flexDirection="column">
        <Header />
        <Box paddingX={1} paddingY={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <Header />
      {updateAvailable && (
        <Box paddingX={1} backgroundColor="yellow">
          <Text color="black" bold>Update available — run: archon-ui update</Text>
        </Box>
      )}
      <TabBar activeTab={activeTab} />
      <Box flexDirection="row" flexGrow={1}>
        <Box flexShrink={0} width={32} overflow="hidden">
          <TaskList runs={filteredRuns} selectedIndex={selectedIndex} />
        </Box>
        <Box flexDirection="column" flexShrink={0} flexGrow={0}>
          <Text color="grey">{"│"}</Text>
        </Box>
        <DetailPanel run={selectedRun} events={events} />
      </Box>
    </Box>
  );
}
