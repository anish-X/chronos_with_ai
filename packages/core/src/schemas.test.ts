import { describe, it, expect } from 'vitest';
import { scheduleSchema, createScheduleSchema, jobStatusSchema, runStatusSchema } from './schemas';

describe('core schemas', () => {
  it('validates schedule', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'daily-summary',
      cronExpr: '0 8 * * *',
      timezone: 'UTC',
      taskName: 'summarize_video',
      payload: { url: 'https://youtube.com/watch?v=...' },
      startAt: new Date(),
      endAt: null,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = scheduleSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid cron', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'test',
      cronExpr: '',
      timezone: 'UTC',
      taskName: 'task',
      payload: {},
      startAt: new Date(),
      endAt: null,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = scheduleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates job status enum', () => {
    expect(jobStatusSchema.safeParse('pending').success).toBe(true);
    expect(jobStatusSchema.safeParse('succeeded').success).toBe(true);
    expect(jobStatusSchema.safeParse('invalid').success).toBe(false);
  });

  it('validates run status enum', () => {
    expect(runStatusSchema.safeParse('running').success).toBe(true);
    expect(runStatusSchema.safeParse('failed').success).toBe(true);
    expect(runStatusSchema.safeParse('invalid').success).toBe(false);
  });

  it('create schedule omits id and timestamps', () => {
    const input = {
      name: 'test',
      cronExpr: '0 * * * *',
      timezone: 'UTC',
      taskName: 'task',
      payload: {},
      startAt: new Date(),
      endAt: null,
      enabled: true,
    };
    const result = createScheduleSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});