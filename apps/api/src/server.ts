import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initializeMonthlySummaryCron } from './modules/monthly-summary/monthlySummary.cron';
import { TelegramPollingService } from './modules/telegram/telegram.polling';
import { TelegramService } from './modules/telegram/telegram.service';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Splitwise API server running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`Client URL: ${env.APP_URL}`);

  // Start cron scheduler
  initializeMonthlySummaryCron();

  // In production (Render, etc.), automatically register Telegram webhook
  if (env.isProduction) {
    TelegramService.autoRegisterWebhook();
  }

  // In local development, optionally poll Telegram updates
  if (!env.isProduction && process.env.NODE_ENV !== 'production' && process.env.ENABLE_TELEGRAM_POLLING === 'true') {
    TelegramPollingService.startPolling();
  }
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
