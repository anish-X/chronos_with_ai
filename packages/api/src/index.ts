import express from 'express';
import { pino } from 'pino';

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(express.json());
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'request');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/tasks', (req, res) => {
  res.json([]);
});

app.get('/api/schedules', (req, res) => {
  res.json([]);
});

app.get('/api/jobs', (req, res) => {
  res.json([]);
});

app.get('/api/metrics', (req, res) => {
  res.json({
    queueDepthPending: 0,
    queueDepthClaimed: 0,
    jobsCreatedTotal: 0,
    jobsSucceededTotal: 0,
    jobsFailedTotal: 0,
    workerCount: 0,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API server started');
});