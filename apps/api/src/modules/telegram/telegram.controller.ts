import { Request, Response, NextFunction } from 'express';
import { TelegramService } from './telegram.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { env } from '../../config/env';

export class TelegramController {
  static async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return res.status(200).json({
        success: true,
        data: {
          connected: req.user!.telegramConnected,
          telegramUsername: req.user!.telegramUsername,
          botUsername: env.TELEGRAM_BOT_USERNAME || undefined
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async connect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await TelegramService.generateConnectLink(req.user!.id);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await TelegramService.disconnect(req.user!.id);
      return res.status(200).json({
        success: true,
        message: 'Telegram disconnected successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
      await TelegramService.handleWebhook(req.body, secretHeader);
      // Telegram webhook requires immediate 200 OK
      return res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}
