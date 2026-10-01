import type { ZodType } from 'zod';

export type JobStatus = 'pending' | 'claimed' | 'running' | 'succeeded' | 'failed' | 'dead_letter';
export type RunStatus = 'running' | 'succeeded' | 'failed';

export interface Schedule {
  id: string;
  name: string;
  cronExpr: string;
  timezone: string;
  taskName: string;
  payload: Record<string, unknown>;
  startAt: Date | null;
  endAt: Date | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Job {
  id: string;
  scheduleId: string | null;
  taskName: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: JobStatus;
  priority: number;
  maxRetries: number;
  retryCount: number;
  nextRetryAt: Date | null;
  createdAt: Date;
  claimedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  workerId: string | null;
}

export interface Run {
  id: string;
  jobId: string;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  logs: string | null;
  error: string | null;
  output: Record<string, unknown> | null;
}

export interface Task {
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  createdAt: Date;
}

export interface TaskDefinition<Input = unknown, Output = unknown> {
  name: string;
  description?: string;
  inputSchema: ZodType<Input>;
  outputSchema: ZodType<Output>;
  execute(input: Input): Promise<Output>;
}

