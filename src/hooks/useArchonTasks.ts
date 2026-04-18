import { useState, useEffect, useRef, useCallback } from "react";
import { homedir } from "os";
import { join } from "path";
import type { WorkflowRun } from "../types.js";
import { openDb, fetchWorkflowRuns } from "../data/db.js";
import type { Database } from "bun:sqlite";

const DEFAULT_DB_PATH = join(homedir(), ".archon", "archon.db");

interface UseArchonTasksResult {
  runs: WorkflowRun[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  refresh: () => void;
  error: string | null;
}

export function useArchonTasks(dbPath: string = DEFAULT_DB_PATH): UseArchonTasksResult {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<Database | null>(null);

  const doFetch = useCallback(() => {
    if (!dbRef.current) return;
    try {
      const data = fetchWorkflowRuns(dbRef.current);
      setRuns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let db: Database | null = null;
    try {
      db = openDb(dbPath);
      dbRef.current = db;
      // Initial fetch
      const data = fetchWorkflowRuns(db);
      setRuns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return () => {};
    }

    const intervalId = setInterval(() => {
      doFetch();
    }, 2000);

    return () => {
      clearInterval(intervalId);
      db?.close();
      dbRef.current = null;
    };
  }, [dbPath, doFetch]);

  return {
    runs,
    selectedIndex,
    setSelectedIndex,
    refresh: doFetch,
    error,
  };
}
