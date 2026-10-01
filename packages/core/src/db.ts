import { Kysely, PostgresDialect } from 'kysely';
import type { Insertable, Updateable } from 'kysely';
import { Pool } from 'pg';

export interface Database {
  schedules: ScheduleTable;
  jobs: JobTable;
  runs: RunTable;
  tasks: TaskTable;
}

export interface ScheduleTable {
  id: string;
  name: string;
  cron_expr: string;
  timezone: string;
  task_name: string;
  payload: Record<string, unknown>;
  start_at: Date | null;
  end_at: Date | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface JobTable {
  id: string;
  schedule_id: string | null;
  task_name: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: string;
  priority: number;
  max_retries: number;
  retry_count: number;
  next_retry_at: Date | null;
  created_at: Date;
  claimed_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
}

export interface RunTable {
  id: string;
  job_id: string;
  status: string;
  started_at: Date;
  finished_at: Date | null;
  logs: string | null;
  error: string | null;
  output: Record<string, unknown> | null;
}

export interface TaskTable {
  name: string;
  description: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  created_at: Date;
}

export type ScheduleInsert = Insertable<ScheduleTable>;
export type ScheduleUpdate = Updateable<ScheduleTable>;
export type JobInsert = Insertable<JobTable>;
export type JobUpdate = Updateable<JobTable>;
export type RunInsert = Insertable<RunTable>;
export type RunUpdate = Updateable<RunTable>;
export type TaskInsert = Insertable<TaskTable>;
export type TaskUpdate = Updateable<TaskTable>;

export function createDatabase(): Kysely<Database> {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://chronos:chronos@localhost:5433/chronos';
  
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
        max: 10,
      }),
    }),
  });
}