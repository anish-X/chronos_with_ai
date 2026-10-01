import { Redis } from 'ioredis';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { createDatabase, type Database, type JobTable } from './db.js';
import type { Job, JobStatus } from './types.js';

const QUEUE_KEY = 'queue:jobs';
const PROCESSING_PREFIX = 'processing:jobs:';

export interface QueueClientOptions {
  redisUrl?: string;
  databaseUrl?: string;
  workerId: string;
  claimTimeoutMs?: number;
}

export class QueueClient {
  private redis: Redis;
  private db: Kysely<Database>;
  private workerId: string;
  private claimTimeoutMs: number;
  private processingKey: string;

  constructor(options: QueueClientOptions) {
    this.workerId = options.workerId;
    this.claimTimeoutMs = options.claimTimeoutMs ?? 5000;
    this.processingKey = `${PROCESSING_PREFIX}${this.workerId}`;

    this.redis = new Redis(options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6380', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    this.db = createDatabase();
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    await this.db.destroy();
  }

  async claimJob(): Promise<Job | null> {
    const jobId = await this.claimJobRedis();
    if (jobId) {
      return this.claimJobPostgres(jobId);
    }
    return this.claimJobPostgresFallback();
  }

  private async claimJobRedis(): Promise<string | null> {
    try {
      const result = await this.redis.blmove(
        QUEUE_KEY,
        this.processingKey,
        'RIGHT',
        'LEFT',
        Math.ceil(this.claimTimeoutMs / 1000)
      );
      return result;
    } catch (error) {
      return null;
    }
  }

  private async claimJobPostgres(jobId: string): Promise<Job | null> {
    const job = await this.db
      .updateTable('jobs')
      .set({
        status: 'claimed' as JobStatus,
        claimed_at: new Date(),
        worker_id: this.workerId,
      })
      .where('id', '=', jobId)
      .where('status', '=', 'pending')
      .returningAll()
      .executeTakeFirst();

    if (!job) {
      await this.redis.lrem(this.processingKey, 1, jobId);
      await this.redis.lpush(QUEUE_KEY, jobId);
      return null;
    }

    return this.mapJobTableToJob(job);
  }

  private async claimJobPostgresFallback(): Promise<Job | null> {
    const job = await this.db
      .updateTable('jobs')
      .set({
        status: 'claimed' as JobStatus,
        claimed_at: new Date(),
        worker_id: this.workerId,
      })
      .where('status', '=', 'pending')
      .where((eb) =>
        eb.or([
          eb('next_retry_at', 'is', null),
          eb('next_retry_at', '<=', new Date()),
        ])
      )
      .where('id', 'in', (qb) =>
        qb
          .selectFrom('jobs')
          .select('id')
          .where('status', '=', 'pending')
          .where((eb) =>
            eb.or([
              eb('next_retry_at', 'is', null),
              eb('next_retry_at', '<=', new Date()),
            ])
          )
          .orderBy('priority', 'desc')
          .orderBy('created_at', 'asc')
          .limit(1)
      )
      .returningAll()
      .executeTakeFirst();

    if (!job) {
      return null;
    }

    return this.mapJobTableToJob(job);
  }

  async requeueStaleJobs(): Promise<number> {
    const staleJobIds = await this.redis.lrange(this.processingKey, 0, -1);
    if (staleJobIds.length === 0) {
      return 0;
    }

    await this.db
      .updateTable('jobs')
      .set({
        status: 'pending' as JobStatus,
        claimed_at: null,
        worker_id: null,
      })
      .where('id', 'in', staleJobIds)
      .execute();

    await this.redis.del(this.processingKey);

    if (staleJobIds.length > 0) {
      await this.redis.lpush(QUEUE_KEY, ...staleJobIds.reverse());
    }

    return staleJobIds.length;
  }

  async publishJob(jobId: string): Promise<void> {
    await this.redis.lpush(QUEUE_KEY, jobId);
  }

  async completeJob(
    jobId: string,
    status: 'succeeded' | 'failed',
    _output?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date();
    await this.db
      .updateTable('jobs')
      .set({
        status: status as JobStatus,
        finished_at: now,
      })
      .where('id', '=', jobId)
      .execute();

    await this.redis.lrem(this.processingKey, 1, jobId);
  }

  async scheduleRetry(jobId: string, backoffMs: number): Promise<void> {
    const nextRetryAt = new Date(Date.now() + backoffMs);

    await this.db
      .updateTable('jobs')
      .set({
        status: 'pending' as JobStatus,
        retry_count: sql`retry_count + 1`,
        next_retry_at: nextRetryAt,
        claimed_at: null,
        worker_id: null,
      })
      .where('id', '=', jobId)
      .execute();

    await this.redis.lrem(this.processingKey, 1, jobId);
    await this.redis.lpush(QUEUE_KEY, jobId);
  }

  private mapJobTableToJob(job: JobTable): Job {
    return {
      id: job.id,
      scheduleId: job.schedule_id,
      taskName: job.task_name,
      payload: job.payload,
      idempotencyKey: job.idempotency_key,
      status: job.status as JobStatus,
      priority: job.priority,
      maxRetries: job.max_retries,
      retryCount: job.retry_count,
      nextRetryAt: job.next_retry_at,
      createdAt: job.created_at,
      claimedAt: job.claimed_at,
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      workerId: job.worker_id,
    };
  }
}