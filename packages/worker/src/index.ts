import { pino } from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

logger.info('Worker process started');

setInterval(() => {
  logger.debug('Worker polling...');
}, 5000);