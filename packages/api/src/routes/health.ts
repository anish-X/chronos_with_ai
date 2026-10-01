import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import type { Database } from '@chronos/core';
import { pino } from 'pino';
import { asyncHandler } from '../middleware/async-handler.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function createHealthRouter(db: Kysely<Database>) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      try {
        await db.selectFrom('schedules').select('id').limit(1).execute();

        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: 'connected',
        });
      } catch (error) {
        logger.error({ err: error }, 'Health check failed');
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
        });
      }
    })
  );

  return router;
}