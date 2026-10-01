import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import type { Database, ScheduleInsert } from '@chronos/core';
import cronParser from 'cron-parser';
import { pino } from 'pino';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  scheduleCreateSchema,
  scheduleUpdateSchema,
  scheduleQuerySchema,
  scheduleParamsSchema,
} from '../schemas.js';
import type { ScheduleCreateInput, ScheduleUpdateInput, ScheduleQueryInput } from '../schemas.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function createSchedulesRouter(db: Kysely<Database>) {
  const router = Router();

  router.get(
    '/',
    validateQuery(scheduleQuerySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const query = req.query as unknown as ScheduleQueryInput;
      const { enabled, taskName, limit = 20, offset = 0 } = query;

      try {
        let qb = db.selectFrom('schedules').selectAll();

        if (enabled !== undefined) {
          qb = qb.where('enabled', '=', enabled);
        }
        if (taskName) {
          qb = qb.where('task_name', '=', taskName);
        }

        let countQb = db.selectFrom('schedules').select(db.fn.count('id').as('count'));
        if (enabled !== undefined) {
          countQb = countQb.where('enabled', '=', enabled);
        }
        if (taskName) {
          countQb = countQb.where('task_name', '=', taskName);
        }
        const total = await countQb.executeTakeFirst();

        const schedules = await qb
          .orderBy('created_at', 'desc')
          .limit(limit)
          .offset(offset)
          .execute();

        res.json({
          data: schedules,
          pagination: {
            total: Number(total?.count ?? 0),
            limit,
            offset,
          },
        });
      } catch (error) {
        logger.error({ err: error }, 'Failed to list schedules');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  router.post(
    '/',
    validateBody(scheduleCreateSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const input = req.body as ScheduleCreateInput;
      const { name, cronExpr, timezone, taskName, payload, startAt, endAt, enabled } = input;

      try {
        try {
          cronParser.parseExpression(cronExpr, { tz: timezone });
        } catch {
          return res.status(400).json({ error: 'Invalid cron expression' });
        }

        const schedule = await db
          .insertInto('schedules')
          .values({
            name,
            cron_expr: cronExpr,
            timezone,
            task_name: taskName,
            payload,
            start_at: startAt ? new Date(startAt) : null,
            end_at: endAt ? new Date(endAt) : null,
            enabled,
          } as ScheduleInsert)
          .returningAll()
          .executeTakeFirstOrThrow();

        logger.info({ scheduleId: schedule.id }, 'Schedule created');
        res.status(201).json(schedule);
      } catch (error) {
        logger.error({ err: error }, 'Failed to create schedule');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  router.patch(
    '/:id',
    validateParams(scheduleParamsSchema),
    validateBody(scheduleUpdateSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const input = req.body as ScheduleUpdateInput;

      try {
        if (input.cronExpr) {
          try {
            cronParser.parseExpression(input.cronExpr, { tz: input.timezone ?? 'UTC' });
          } catch {
            return res.status(400).json({ error: 'Invalid cron expression' });
          }
        }

        const schedule = await db
          .updateTable('schedules')
          .set({
            ...(input.name && { name: input.name }),
            ...(input.cronExpr && { cron_expr: input.cronExpr }),
            ...(input.timezone && { timezone: input.timezone }),
            ...(input.taskName && { task_name: input.taskName }),
            ...(input.payload !== undefined && { payload: input.payload }),
            ...(input.startAt !== undefined && { start_at: input.startAt ? new Date(input.startAt) : null }),
            ...(input.endAt !== undefined && { end_at: input.endAt ? new Date(input.endAt) : null }),
            ...(input.enabled !== undefined && { enabled: input.enabled }),
            updated_at: new Date(),
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirst();

        if (!schedule) {
          return res.status(404).json({ error: 'Schedule not found' });
        }

        logger.info({ scheduleId: id }, 'Schedule updated');
        res.json(schedule);
      } catch (error) {
        logger.error({ err: error }, 'Failed to update schedule');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  router.delete(
    '/:id',
    validateParams(scheduleParamsSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      try {
        const result = await db
          .deleteFrom('schedules')
          .where('id', '=', id)
          .executeTakeFirst();

        if (Number(result.numDeletedRows) === 0) {
          return res.status(404).json({ error: 'Schedule not found' });
        }

        logger.info({ scheduleId: id }, 'Schedule deleted');
        res.status(204).send();
      } catch (error) {
        logger.error({ err: error }, 'Failed to delete schedule');
        res.status(500).json({ error: 'Internal server error' });
      }
    })
  );

  return router;
}