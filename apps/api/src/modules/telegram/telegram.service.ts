import crypto from 'crypto';
import { prisma } from '@splitwise/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { formatCurrency } from '../../utils/currency';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';

export class TelegramService {
  /**
   * Generates a single-use deep link token for connecting a Telegram account.
   */
  static async generateConnectLink(userId: string): Promise<{ url: string; expiresAt: string }> {
    if (!env.TELEGRAM_BOT_USERNAME) {
      throw new ValidationError('Telegram bot username is not configured on the server.');
    }

    // Invalidate existing tokens for this user
    await prisma.telegramConnectToken.deleteMany({
      where: { userId }
    });

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.telegramConnectToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    });

    const url = `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${rawToken}`;
    return { url, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Disconnects a user's Telegram account.
   */
  static async disconnect(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramUsername: null,
        telegramConnected: false
      }
    });
  }

  /**
   * Sends an outbound text message to a specific Telegram chat ID.
   */
  static async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      logger.info(`[TELEGRAM SIMULATOR] To ChatId: ${chatId}\n${text}`);
      return true;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.warn('Telegram sendMessage failed', { errorData, chatId });
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Telegram network error during sendMessage', { error: (err as Error).message, chatId });
      return false;
    }
  }

  /**
   * Handles incoming webhook updates from Telegram Bot API.
   */
  static async handleWebhook(update: any, secretHeader?: string): Promise<void> {
    // Verify secret token if configured
    if (env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      throw new UnauthorizedError('Invalid Telegram webhook secret token');
    }

    const message = update?.message;
    if (!message || !message.text) {
      return; // Ignore non-message updates
    }

    const text = message.text.trim();
    const chatId = String(message.chat.id);
    const username = message.from?.username || null;

    // Check for deep link command: /start <token>
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        await this.sendMessage(
          chatId,
          `👋 Welcome to <b>Splitwise Private</b>!\n\nTo link your account, please click the "Connect Telegram" button in your web app dashboard.`
        );
        return;
      }

      const rawToken = parts[1].trim();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const tokenRecord = await prisma.telegramConnectToken.findUnique({
        where: { tokenHash },
        include: { user: true }
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        await this.sendMessage(
          chatId,
          `⚠️ This connection link has expired or is invalid. Please generate a fresh link from the web app.`
        );
        return;
      }

      // Associate Telegram Chat ID with the user
      await prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          telegramChatId: chatId,
          telegramUsername: username,
          telegramConnected: true
        }
      });

      // Invalidate connection token
      await prisma.telegramConnectToken.delete({
        where: { id: tokenRecord.id }
      });

      await this.sendMessage(
        chatId,
        `🎉 <b>Success!</b> Your Telegram account has been linked to <b>${tokenRecord.user.name}</b>.\n\nYou will now receive instant expense notifications and monthly summaries here.`
      );

      logger.info('Telegram account connected', { userId: tokenRecord.userId, chatId, username });
    }
  }

  /**
   * Asynchronously dispatches expense notifications to all connected participants.
   * Safe post-commit hook: Never rolls back transactions on failure.
   */
  static async notifyExpenseAdded(expenseId: string): Promise<void> {
    try {
      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: {
          group: true,
          payer: true,
          splits: {
            include: { user: true }
          }
        }
      });

      if (!expense) return;

      const formattedTotal = formatCurrency(expense.totalAmount);

      // 1. Notify Payer (if connected)
      if (expense.payer.telegramConnected && expense.payer.telegramChatId) {
        const payerSplit = expense.splits.find((s) => s.userId === expense.paidBy);
        const payerShare = payerSplit ? payerSplit.amountOwed : 0;
        const owedToPayer = expense.totalAmount - payerShare;

        const payerMsg = [
          `💸 <b>Expense Added</b>\n`,
          `<b>${expense.description}</b>\n`,
          `You paid: ${formattedTotal}`,
          `Your share: ${formatCurrency(payerShare)}`,
          `You are owed: ${formatCurrency(owedToPayer)}\n`,
          `Group: <i>${expense.group.name}</i>`
        ].join('\n');

        await this.sendMessage(expense.payer.telegramChatId, payerMsg);
      }

      // 2. Notify other participants (if connected)
      for (const split of expense.splits) {
        if (split.userId === expense.paidBy) continue; // Payer already handled

        const user = split.user;
        if (user.telegramConnected && user.telegramChatId) {
          const participantMsg = [
            `💸 <b>New Expense</b>\n`,
            `<b>${expense.description}</b>\n`,
            `Total: ${formattedTotal}`,
            `Paid by: ${expense.payer.name}`,
            `Your share: ${formatCurrency(split.amountOwed)}\n`,
            `Group: <i>${expense.group.name}</i>`
          ].join('\n');

          await this.sendMessage(user.telegramChatId, participantMsg);
        }
      }
    } catch (err) {
      logger.error('Failed to dispatch Telegram notifications', {
        expenseId,
        error: (err as Error).message
      });
    }
  }
}
