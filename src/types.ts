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
  eventType: string;
  toolName: string;
  data: string | null;
  createdAt: string;
}
