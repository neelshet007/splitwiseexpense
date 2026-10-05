import cron from 'node-cron';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { MonthlySummaryService } from './monthlySummary.service';

export function initializeMonthlySummaryCron() {
  if (!env.MONTHLY_SUMMARY_CRON) {
    logger.info('Monthly summary cron is disabled (no cron expression configured)');
    return;
  }

  logger.debug(`Initializing monthly summary scheduler: "${env.MONTHLY_SUMMARY_CRON}" (timezone: ${env.TIMEZONE})`);

  cron.schedule(
    env.MONTHLY_SUMMARY_CRON,
    async () => {
      logger.info('Scheduled monthly summary job triggered');
      try {
        await MonthlySummaryService.runMonthlySummary();
      } catch (err) {
        logger.error('Error in monthly summary cron job', { error: (err as Error).message });
      }
    },
    {
      timezone: env.TIMEZONE
    }
  );
}
