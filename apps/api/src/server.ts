import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initializeMonthlySummaryCron } from './modules/monthly-summary/monthlySummary.cron';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Splitwise API server running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`Client URL: ${env.APP_URL}`);

  // Start cron scheduler
  initializeMonthlySummaryCron();
});

// Graceful shutdown handling
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
