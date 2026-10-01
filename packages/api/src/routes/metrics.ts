import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import type { Database } from '@chronos/core';
import { pino } from 'pino';
import { asyncHandler } from '../middleware/async-handler.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function createMetricsRouter(db: Kysely<Database>) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      try {
        const [
          pendingCount,
          claimedCount,
          createdCount,
          succeededCount,
          failedCount,
        ] = await Promise.all([
          db.selectFrom('jobs').select(db.fn.count('id').as('count')).where('status', '=', 'pending').executeTakeFirst(),
          db.selectFrom('jobs').select(db.fn.count('id').as('count')).where('status', '=', 'claimed').executeTakeFirst(),
          db.selectFrom('jobs').select(db.fn.count('id').as('count')).executeTakeFirst(),
          db.selectFrom('jobs').select(db.fn.count('id').as('count')).where('status', '=', 'succeeded').executeTakeFirst(),
          db.selectFrom('jobs').select(db.fn.count('id').as('count')).where('status', '=', 'failed').executeTakeFirst(),
        ]);

        const workerCount = 0;

        res.json({
          queueDepthPending: Number(pendingCount?.count ?? 0),
          queueDepthClaimed: Number(claimedCount?.count ?? 0),
          jobsCreatedTotal: Number(createdCount?.count ?? 0),
          jobsSucceededTotal: Number(succeededCount?.count ?? 0),
          jobsFailedTotal: Number(failedCount?.count ?? 0),
          workerCount,
        });
      } catch (error) {
        logger.error({ err: error }, 'Failed to get metrics');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  return router;
}