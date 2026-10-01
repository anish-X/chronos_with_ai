import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '@chronos/core';
import { createApiDatabase } from '../services/database.js';
import { createHealthRouter } from '../routes/health.js';
import { createTasksRouter } from '../routes/tasks.js';
import { createSchedulesRouter } from '../routes/schedules.js';
import { createJobsRouter } from '../routes/jobs.js';
import { createMetricsRouter } from '../routes/metrics.js';
import express from 'express';

describe('API Integration Tests', () => {
  let pgContainer: PostgreSqlContainer;
  let redisContainer: RedisContainer;
  let db: Kysely<Database>;
  let app: express.Express;

  beforeAll(async () => {
    // Start PostgreSQL container
    pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('chronos')
      .withUsername('chronos')
      .withPassword('chronos')
      .start();

    // Start Redis container
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    // Set environment variables
    process.env.DATABASE_URL = pgContainer.getConnectionUri();
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getPort()}`;

    // Create database connection and run migrations
    db = createApiDatabase();

    // Run migrations
    await runMigrations(db);

    // Create Express app with all routes
    app = express();
    app.use(express.json());
    app.use('/api/health', createHealthRouter(db));
    app.use('/api/tasks', createTasksRouter());
    app.use('/api/schedules', createSchedulesRouter(db));
    app.use('/api/jobs', createJobsRouter(db));
    app.use('/api/metrics', createMetricsRouter(db));
  }, 120000);

  afterAll(async () => {
    await db.destroy();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  beforeEach(async () => {
    // Clean up data between tests
    await db.deleteFrom('jobs').execute();
    await db.deleteFrom('schedules').execute();
  });

  describe('Health Check', () => {
    it('GET /api/health returns ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('Tasks', () => {
    it('GET /api/tasks returns empty list initially', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Schedules CRUD', () => {
    it('POST /api/schedules creates a schedule', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .send({
          name: 'test-schedule',
          cronExpr: '0 8 * * *',
          timezone: 'UTC',
          taskName: 'reminder',
          payload: { message: 'Hello' },
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('test-schedule');
      expect(res.body.cron_expr).toBe('0 8 * * *');
      expect(res.body.task_name).toBe('reminder');
      expect(res.body.id).toBeDefined();
    });

    it('POST /api/schedules rejects invalid cron', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .send({
          name: 'test',
          cronExpr: 'invalid-cron',
          taskName: 'reminder',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid cron expression');
    });

    it('GET /api/schedules lists schedules', async () => {
      await request(app)
        .post('/api/schedules')
        .send({
          name: 'schedule-1',
          cronExpr: '0 8 * * *',
          taskName: 'reminder',
        });

      const res = await request(app).get('/api/schedules');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('PATCH /api/schedules/:id updates a schedule', async () => {
      const createRes = await request(app)
        .post('/api/schedules')
        .send({
          name: 'original',
          cronExpr: '0 8 * * *',
          taskName: 'reminder',
        });

      const res = await request(app)
        .patch(`/api/schedules/${createRes.body.id}`)
        .send({ name: 'updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('updated');
    });

    it('DELETE /api/schedules/:id deletes a schedule', async () => {
      const createRes = await request(app)
        .post('/api/schedules')
        .send({
          name: 'to-delete',
          cronExpr: '0 8 * * *',
          taskName: 'reminder',
        });

      const delRes = await request(app).delete(`/api/schedules/${createRes.body.id}`);
      expect(delRes.status).toBe(204);

      const getRes = await request(app).get('/api/schedules');
      expect(getRes.body.data).toHaveLength(0);
    });
  });

  describe('Jobs', () => {
    it('POST /api/jobs creates a manual job', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({
          taskName: 'reminder',
          payload: { message: 'Test job' },
        });

      expect(res.status).toBe(201);
      expect(res.body.task_name).toBe('reminder');
      expect(res.body.status).toBe('pending');
      expect(res.body.idempotency_key).toBeDefined();
    });

    it('POST /api/jobs with same payload returns conflict', async () => {
      await request(app)
        .post('/api/jobs')
        .send({
          taskName: 'reminder',
          payload: { message: 'Duplicate' },
        });

      const res = await request(app)
        .post('/api/jobs')
        .send({
          taskName: 'reminder',
          payload: { message: 'Duplicate' },
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Job with this payload already exists');
    });

    it('GET /api/jobs lists jobs', async () => {
      await request(app)
        .post('/api/jobs')
        .send({
          taskName: 'reminder',
          payload: { message: 'Job 1' },
        });

      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /api/jobs/:id returns job with runs', async () => {
      const createRes = await request(app)
        .post('/api/jobs')
        .send({
          taskName: 'reminder',
          payload: { message: 'Test' },
        });

      const res = await request(app).get(`/api/jobs/${createRes.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(Array.isArray(res.body.runs)).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('GET /api/metrics returns metrics', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(typeof res.body.queueDepthPending).toBe('number');
      expect(typeof res.body.jobsCreatedTotal).toBe('number');
    });
  });
});

async function runMigrations(db: Kysely<Database>): Promise<void> {
  // Create tables
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