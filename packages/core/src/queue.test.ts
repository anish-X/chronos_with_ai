import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { QueueClient } from './queue.js';
import { createDatabase, type Database } from './db.js';
import { Kysely, sql } from 'kysely';
import RedisMock from 'ioredis-mock';
import { startedPostgreSqlContainer, getDatabaseUrl, stopPostgreSqlContainer } from './testcontainers-setup.js';

vi.mock('ioredis', async () => {
  const RedisMockModule = await import('ioredis-mock');
  return {
    default: RedisMockModule.default,
    Redis: RedisMockModule.default,
  };
});

describe('QueueClient', () => {
  let db: Kysely<Database>;
  let queueClient: QueueClient;
  const workerId = 'test-worker-1';

  beforeAll(async () => {
    await startedPostgreSqlContainer;
    const databaseUrl = getDatabaseUrl();
    db = createDatabase();
    
    queueClient = new QueueClient({
      workerId,
      redisUrl: 'redis://localhost:6380',
      databaseUrl,
    });
    
    await queueClient.connect();
  }, 60000);

  afterAll(async () => {
    await queueClient.disconnect();
    await stopPostgreSqlContainer();
  }, 10000);

  beforeEach(async () => {
    await db.deleteFrom('jobs').execute();
    await db.deleteFrom('schedules').execute();
    
    const redis = (queueClient as any).redis;
    await redis.flushall();
  });

  describe('claimJob', () => {
    it('should claim a job from Redis and update PostgreSQL', async () => {
      const jobId = await createTestJob(db);
      
      const redis = (queueClient as any).redis;
      await redis.lpush('queue:jobs', jobId);

      const claimedJob = await queueClient.claimJob();

      expect(claimedJob).not.toBeNull();
      expect(claimedJob?.id).toBe(jobId);
      expect(claimedJob?.status).toBe('claimed');
      expect(claimedJob?.workerId).toBe(workerId);
      expect(claimedJob?.claimedAt).not.toBeNull();

      const dbJob = await db.selectFrom('jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
      expect(dbJob?.status).toBe('claimed');
      expect(dbJob?.worker_id).toBe(workerId);
    });

    it('should return null when no jobs in queue', async () => {
      const claimedJob = await queueClient.claimJob();
      expect(claimedJob).toBeNull();
    });

    it('should fallback to PostgreSQL when Redis fails', async () => {
      const jobId = await createTestJob(db, { priority: 10 });
      
      const redis = (queueClient as any).redis;
      redis.blmove = vi.fn().mockRejectedValue(new Error('Redis error'));

      const claimedJob = await queueClient.claimJob();

      expect(claimedJob).not.toBeNull();
      expect(claimedJob?.id).toBe(jobId);
      expect(claimedJob?.status).toBe('claimed');
    });

    it('should claim highest priority job first in fallback', async () => {
      const lowPriorityJobId = await createTestJob(db, { priority: 1 });
      const highPriorityJobId = await createTestJob(db, { priority: 100 });
      
      const redis = (queueClient as any).redis;
      redis.blmove = vi.fn().mockRejectedValue(new Error('Redis error'));

      const claimedJob = await queueClient.claimJob();

      expect(claimedJob?.id).toBe(highPriorityJobId);
    });
  });

  describe('requeueStaleJobs', () => {
    it('should requeue jobs from processing list back to queue', async () => {
      const jobId = await createTestJob(db);
      
      const redis = (queueClient as any).redis;
      await redis.lpush(`processing:jobs:${workerId}`, jobId);
      
      await db.updateTable('jobs').set({ status: 'claimed', worker_id: workerId, claimed_at: new Date() }).where('id', '=', jobId).execute();

      const requeuedCount = await queueClient.requeueStaleJobs();

      expect(requeuedCount).toBe(1);

      const dbJob = await db.selectFrom('jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
      expect(dbJob?.status).toBe('pending');
      expect(dbJob?.worker_id).toBeNull();
      expect(dbJob?.claimed_at).toBeNull();

      const queueLength = await redis.llen('queue:jobs');
      expect(queueLength).toBe(1);
    });

    it('should return 0 when no stale jobs', async () => {
      const requeuedCount = await queueClient.requeueStaleJobs();
      expect(requeuedCount).toBe(0);
    });
  });

  describe('publishJob', () => {
    it('should add job to Redis queue', async () => {
      const jobId = await createTestJob(db);

      await queueClient.publishJob(jobId);

      const redis = (queueClient as any).redis;
      const queueLength = await redis.llen('queue:jobs');
      expect(queueLength).toBe(1);
    });
  });

  describe('completeJob', () => {
    it('should mark job as succeeded and remove from processing', async () => {
      const jobId = await createTestJob(db);
      
      const redis = (queueClient as any).redis;
      await redis.lpush(`processing:jobs:${workerId}`, jobId);
      await db.updateTable('jobs').set({ status: 'claimed', worker_id: workerId, claimed_at: new Date() }).where('id', '=', jobId).execute();

      await queueClient.completeJob(jobId, 'succeeded');

      const dbJob = await db.selectFrom('jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
      expect(dbJob?.status).toBe('succeeded');
      expect(dbJob?.finished_at).not.toBeNull();

      const processingLength = await redis.llen(`processing:jobs:${workerId}`);
      expect(processingLength).toBe(0);
    });

    it('should mark job as failed and remove from processing', async () => {
      const jobId = await createTestJob(db);
      
      const redis = (queueClient as any).redis;
      await redis.lpush(`processing:jobs:${workerId}`, jobId);
      await db.updateTable('jobs').set({ status: 'claimed', worker_id: workerId, claimed_at: new Date() }).where('id', '=', jobId).execute();

      await queueClient.completeJob(jobId, 'failed');

      const dbJob = await db.selectFrom('jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
      expect(dbJob?.status).toBe('failed');
    });
  });

  describe('scheduleRetry', () => {
    it('should schedule retry with backoff and requeue', async () => {
      const jobId = await createTestJob(db, { retryCount: 0, maxRetries: 3 });
      
      const redis = (queueClient as any).redis;
      await redis.lpush(`processing:jobs:${workerId}`, jobId);
      await db.updateTable('jobs').set({ status: 'claimed', worker_id: workerId, claimed_at: new Date() }).where('id', '=', jobId).execute();

      await queueClient.scheduleRetry(jobId, 5000);

      const dbJob = await db.selectFrom('jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
      expect(dbJob?.status).toBe('pending');
      expect(dbJob?.retry_count).toBe(1);
      expect(dbJob?.next_retry_at).not.toBeNull();
      expect(dbJob?.worker_id).toBeNull();
      expect(dbJob?.claimed_at).toBeNull();

      const queueLength = await redis.llen('queue:jobs');
      expect(queueLength).toBe(1);
    });

    it('should increment retry count on each retry', async () => {
      const jobId = await createTestJob(db, { retryCount: 1, maxRetries: 3 });
      
      const redis = (queueClient as any).redis;
      await redis.lpush(`processing:jobs:${workerId}`, jobId);
      await db.updateTable('jobs').set({ status: 'claimed', worker_id: workerId, claimed_at: new Date() }).where('id', '=', jobId).execute();

      await queueClient.scheduleRetry(jobId, 1000);
      await queueClient.scheduleRetry(jobId, 1000);

      const dbJob = await db.selectFrom('jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
      expect(dbJob?.retry_count).toBe(3);
    });
  });
});

async function createTestJob(
  db: Kysely<Database>,
  options: { priority?: number; retryCount?: number; maxRetries?: number } = {}
): Promise<string> {
  const result = await db
    .insertInto('jobs')
    .values({
      schedule_id: null,
      task_name: 'test_task',
      payload: { test: true },
      idempotency_key: `test-key-${Date.now()}-${Math.random()}`,
      status: 'pending',
      priority: options.priority ?? 0,
      max_retries: options.maxRetries ?? 3,
      retry_count: options.retryCount ?? 0,
      next_retry_at: null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  
  return result.id;
}