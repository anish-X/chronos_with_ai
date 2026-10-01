import { z } from 'zod';

export const scheduleCreateSchema = z.object({
  name: z.string().min(1).max(255),
  cronExpr: z.string().min(1),
  timezone: z.string().default('UTC'),
  taskName: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  enabled: z.boolean().default(true),
});

export const scheduleUpdateSchema = scheduleCreateSchema.partial();

export const scheduleQuerySchema = z.object({
  enabled: z.coerce.boolean().optional(),
  taskName: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const scheduleParamsSchema = z.object({
  id: z.string().uuid(),
});

export const jobCreateSchema = z.object({
  taskName: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().default(0),
  maxRetries: z.number().int().positive().default(3),
});

export const jobQuerySchema = z.object({
  status: z.enum(['pending', 'claimed', 'running', 'succeeded', 'failed', 'dead_letter']).optional(),
  taskName: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const jobParamsSchema = z.object({
  id: z.string().uuid(),
});

export const runParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;
export type ScheduleQueryInput = z.infer<typeof scheduleQuerySchema>;
export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export type JobQueryInput = z.infer<typeof jobQuerySchema>;