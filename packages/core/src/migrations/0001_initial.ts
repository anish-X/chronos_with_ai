import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('schedules')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('cron_expr', 'text', (col) => col.notNull())
    .addColumn('timezone', 'text', (col) => col.notNull().defaultTo('UTC'))
    .addColumn('task_name', 'text', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull().defaultTo('{}'))
    .addColumn('start_at', 'timestamptz')
    .addColumn('end_at', 'timestamptz')
    .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('jobs')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('schedule_id', 'uuid', (col) => col.references('schedules.id').onDelete('set null'))
    .addColumn('task_name', 'text', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('idempotency_key', 'text', (col) => col.notNull().unique())
    .addColumn('status', 'text', (col) => col.notNull().check(sql`status IN ('pending','claimed','running','succeeded','failed','dead_letter')`))
    .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('max_retries', 'integer', (col) => col.notNull().defaultTo(3))
    .addColumn('retry_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('next_retry_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('claimed_at', 'timestamptz')
    .addColumn('started_at', 'timestamptz')
    .addColumn('finished_at', 'timestamptz')
    .execute();

  await db.schema.createIndex('idx_jobs_status').on('jobs').column('status').where(sql`status IN ('pending','claimed')`).execute();
  await db.schema.createIndex('idx_jobs_next_retry').on('jobs').column('next_retry_at').where(sql`status = 'pending'`).execute();

  await db.schema
    .createTable('runs')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('job_id', 'uuid', (col) => col.notNull().references('jobs.id').onDelete('cascade'))
    .addColumn('status', 'text', (col) => col.notNull().check(sql`status IN ('running','succeeded','failed')`))
    .addColumn('started_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('finished_at', 'timestamptz')
    .addColumn('logs', 'text')
    .addColumn('error', 'text')
    .addColumn('output', 'jsonb')
    .execute();

  await db.schema.createIndex('idx_runs_job').on('runs').column('job_id').execute();

  await db.schema
    .createTable('tasks')
    .addColumn('name', 'text', (col) => col.primaryKey())
    .addColumn('description', 'text')
    .addColumn('input_schema', 'jsonb', (col) => col.notNull())
    .addColumn('output_schema', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('tasks').execute();
  await db.schema.dropTable('runs').execute();
  await db.schema.dropTable('jobs').execute();
  await db.schema.dropTable('schedules').execute();
}