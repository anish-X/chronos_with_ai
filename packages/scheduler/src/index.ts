import { pino } from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

logger.info('Scheduler process started');

setInterval(() => {
  logger.debug('Scheduler polling...');
}, 10000);