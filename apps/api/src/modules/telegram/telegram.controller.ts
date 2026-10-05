import { Request, Response, NextFunction } from 'express';
import { TelegramService } from './telegram.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { env } from '../../config/env';
import { updateTelegramUsernameSchema, updateNotificationPreferencesSchema } from '@splitwise/validation';
import { prisma } from '@splitwise/database';

export class TelegramController {
  static async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id }
      });

      return res.status(200).json({
        success: true,
        data: {
          connected: user?.telegramConnected ?? false,
          telegramUsername: user?.telegramUsername ?? null,
          telegramConnectedAt: user?.telegramConnectedAt?.toISOString() ?? null,
          botUsername: env.TELEGRAM_BOT_USERNAME || undefined,
          preferences: {
            notifyExpenseAdded: user?.notifyExpenseAdded ?? true,
            notifyMonthlySummary: user?.notifyMonthlySummary ?? true,
            notifySettlements: user?.notifySettlements ?? true,
            notifyPasswordReset: user?.notifyPasswordReset ?? true
          }
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

  static async updateUsername(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = updateTelegramUsernameSchema.parse(req.body);
      await TelegramService.updateUsername(req.user!.id, validated.telegramUsername);
      return res.status(200).json({
        success: true,
        message: 'Telegram username updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePreferences(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = updateNotificationPreferencesSchema.parse(req.body);
      await TelegramService.updatePreferences(req.user!.id, validated);
      return res.status(200).json({
        success: true,
        message: 'Notification preferences updated successfully'
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

  static async setupWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TelegramService.autoRegisterWebhook();
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getWebhookInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const info = await TelegramService.getWebhookInfo();
      return res.status(200).json(info);
    } catch (error) {
      next(error);
    }
  }
}
