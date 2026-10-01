import { Router } from 'express';
import type { Request, Response } from 'express';
import { pino } from 'pino';
import { taskRegistry } from '@chronos/core';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function createTasksRouter() {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    try {
      const tasks = taskRegistry.list().map(task => ({
        name: task.name,
        description: task.description ?? null,
        inputSchema: task.inputSchema,
        outputSchema: task.outputSchema,
      }));

      logger.debug({ count: tasks.length }, 'Listed tasks');
      res.json(tasks);
    } catch (error) {
      logger.error({ err: error }, 'Failed to list tasks');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}