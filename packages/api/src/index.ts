import express from 'express';
import { pino } from 'pino';
import { createApiDatabase } from './services/database.js';
import { createHealthRouter } from './routes/health.js';
import { createTasksRouter } from './routes/tasks.js';
import { createSchedulesRouter } from './routes/schedules.js';
import { createJobsRouter } from './routes/jobs.js';
import { createMetricsRouter } from './routes/metrics.js';

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const db = createApiDatabase();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'request');
  next();
});

// Routes
app.use('/api/health', createHealthRouter(db));
app.use('/api/tasks', createTasksRouter());
app.use('/api/schedules', createSchedulesRouter(db));
app.use('/api/jobs', createJobsRouter(db));
app.use('/api/metrics', createMetricsRouter(db));

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API server started');
});

export { app };