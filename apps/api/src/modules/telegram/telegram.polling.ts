import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { TelegramService } from './telegram.service';

export class TelegramPollingService {
  private static isRunning = false;
  private static lastUpdateId = 0;

  /**
   * Starts long-polling for incoming Telegram updates in local development.
   * Eliminates the need for ngrok or public HTTPS webhooks when testing on localhost.
   */
  static startPolling(): void {
    if (env.isProduction || process.env.NODE_ENV === 'production') {
      return;
    }
    if (this.isRunning) return;

    if (!env.TELEGRAM_BOT_TOKEN) {
      logger.info('Telegram Bot token is not configured in .env. Polling inactive.');
      return;
    }

    this.isRunning = true;
    logger.info('🤖 Telegram Bot long-polling started for local development');

    const poll = async () => {
      while (this.isRunning) {
        try {
          const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
          const res = await fetch(url);

          if (res.ok) {
            const data = (await res.json()) as any;
            if (data.ok && Array.isArray(data.result)) {
              for (const update of data.result) {
                this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
                try {
                  await TelegramService.handleWebhook(update, undefined, true);
                } catch (webhookErr) {
                  logger.warn('Error processing Telegram update', { error: (webhookErr as Error).message });
                }
              }
            }
          } else {
            // Rate limit or error from Telegram
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (err) {
          // Network interruption, wait and continue
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    };

    poll().catch((err) => {
      logger.error('Telegram polling loop error', { error: (err as Error).message });
      this.isRunning = false;
    });
  }

  static stopPolling(): void {
    this.isRunning = false;
  }
}
