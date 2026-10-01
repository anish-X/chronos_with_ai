import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import type { Database, JobInsert } from '@chronos/core';
import { createHash } from 'crypto';
import { pino } from 'pino';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  jobCreateSchema,
  jobQuerySchema,
  jobParamsSchema,
} from '../schemas.js';
import type { JobCreateInput, JobQueryInput } from '../schemas.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

function generateIdempotencyKey(taskName: string, payload: Record<string, unknown>): string {
  const content = `${taskName}:${JSON.stringify(payload)}`;
  return createHash('sha256').update(content).digest('hex').substring(0, 32);
}

export function createJobsRouter(db: Kysely<Database>) {
  const router = Router();

  router.get(
    '/',
    validateQuery(jobQuerySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const query = req.query as unknown as JobQueryInput;
      const { status, taskName, startDate, endDate, limit = 20, offset = 0 } = query;

      try {
        let qb = db.selectFrom('jobs').selectAll();

        if (status) {
          qb = qb.where('status', '=', status);
        }
        if (taskName) {
          qb = qb.where('task_name', '=', taskName);
        }
        if (startDate) {
          qb = qb.where('created_at', '>=', new Date(startDate));
        }
        if (endDate) {
          qb = qb.where('created_at', '<=', new Date(endDate));
        }

        let countQb = db.selectFrom('jobs').select(db.fn.count('id').as('count'));
        if (status) {
          countQb = countQb.where('status', '=', status);
        }
        if (taskName) {
          countQb = countQb.where('task_name', '=', taskName);
        }
        if (startDate) {
          countQb = countQb.where('created_at', '>=', new Date(startDate));
        }
        if (endDate) {
          countQb = countQb.where('created_at', '<=', new Date(endDate));
        }
        const total = await countQb.executeTakeFirst();

        const jobs = await qb
          .orderBy('created_at', 'desc')
          .limit(limit)
          .offset(offset)
          .execute();

        res.json({
          data: jobs,
          pagination: {
            total: Number(total?.count ?? 0),
            limit,
            offset,
          },
        });
      } catch (error) {
        logger.error({ err: error }, 'Failed to list jobs');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  router.get(
    '/:id',
    validateParams(jobParamsSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      try {
        const job = await db
          .selectFrom('jobs')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst();

        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        const runs = await db
          .selectFrom('runs')
          .selectAll()
          .where('job_id', '=', id)
          .orderBy('started_at', 'desc')
          .execute();

        res.json({ ...job, runs });
      } catch (error) {
        logger.error({ err: error }, 'Failed to get job');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  router.post(
    '/',
    validateBody(jobCreateSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const input = req.body as JobCreateInput;
      const { taskName, payload, priority = 0, maxRetries = 3 } = input;

      try {
        const idempotencyKey = generateIdempotencyKey(taskName, payload);

        const job = await db
          .insertInto('jobs')
          .values({
            task_name: taskName,
            payload,
            idempotency_key: idempotencyKey,
            status: 'pending',
            priority,
            max_retries: maxRetries,
            retry_count: 0,
          } as JobInsert)
          .onConflict((oc) => oc.column('idempotency_key').doNothing())
          .returningAll()
          .executeTakeFirst();

        if (!job) {
          const existingJob = await db
            .selectFrom('jobs')
            .selectAll()
            .where('idempotency_key', '=', idempotencyKey)
            .executeTakeFirst();

          return res.status(409).json({
            error: 'Job with this payload already exists',
            job: existingJob,
          });
        }

        logger.info({ jobId: job.id, taskName }, 'Manual job created');
        res.status(201).json(job);
      } catch (error) {
        logger.error({ err: error }, 'Failed to create job');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  return router;
}