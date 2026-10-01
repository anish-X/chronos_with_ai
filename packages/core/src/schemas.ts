import { z } from 'zod';

export const jobStatusSchema = z.enum(['pending', 'claimed', 'running', 'succeeded', 'failed', 'dead_letter']);
export const runStatusSchema = z.enum(['running', 'succeeded', 'failed']);

export const scheduleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  cronExpr: z.string().min(1),
  timezone: z.string().default('UTC'),
  taskName: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  startAt: z.date().nullable(),
  endAt: z.date().nullable(),
  enabled: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createScheduleSchema = scheduleSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const updateScheduleSchema = createScheduleSchema.partial();

export const jobSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid().nullable(),
  taskName: z.string().min(1),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().min(1),
  status: jobStatusSchema,
  priority: z.number().int().default(0),
  maxRetries: z.number().int().default(3),
  retryCount: z.number().int().default(0),
  nextRetryAt: z.date().nullable(),
  createdAt: z.date(),
  claimedAt: z.date().nullable(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  workerId: z.string().nullable(),
});

export const createJobSchema = jobSchema.omit({
  id: true,
  status: true,
  retryCount: true,
  createdAt: true,
  claimedAt: true,
  startedAt: true,
  finishedAt: true,
});

export const runSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  status: runStatusSchema,
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  logs: z.string().nullable(),
  error: z.string().nullable(),
  output: z.record(z.unknown()).nullable(),
});

export const taskSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  createdAt: z.date(),
});

export const queueMetricsSchema = z.object({
  queueDepthPending: z.number().int().nonnegative(),
  queueDepthClaimed: z.number().int().nonnegative(),
  jobsCreatedTotal: z.number().int().nonnegative(),
  jobsSucceededTotal: z.number().int().nonnegative(),
  jobsFailedTotal: z.number().int().nonnegative(),
  workerCount: z.number().int().nonnegative(),
});

export type ScheduleInput = z.infer<typeof createScheduleSchema>;
export type JobInput = z.infer<typeof createJobSchema>;
export type RunInput = z.infer<typeof runSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type QueueMetrics = z.infer<typeof queueMetricsSchema>;