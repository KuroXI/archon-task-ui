export interface WorkflowRun {
  id: string;
  workflowName: string;
  status: string;
  workingPath: string | null;
  startedAt: string;
  branchName: string | null;
  elapsedSeconds: number;
}

export interface WorkflowEvent {
  id: string;
  workflowRunId: string;
  eventType: string;
  stepName: string | null;
  data: string | null;
  createdAt: string;
}

export interface StepSummary {
  stepName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  loopIteration: number | null;
  maxIterations: number | null;
  retryCount: number | null;
}

export interface ToolCallEntry {
  toolName: string;
  fields: Array<{ key: string; value: string }>;
  durationMs: number | null;
  status: "running" | "completed" | "failed";
  createdAt: string;
}

export type StepGroup =
  | { type: "single"; step: StepSummary }
  | { type: "parallel"; steps: StepSummary[] };
