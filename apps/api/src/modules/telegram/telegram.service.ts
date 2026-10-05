import crypto from 'crypto';
import { prisma } from '@splitwise/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { formatCurrency } from '../../utils/currency';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { UpdateNotificationPreferencesInput } from '@splitwise/validation';

export class TelegramService {
  /**
   * Generates a single-use deep link token for securely connecting a Telegram account.
   */
  static async generateConnectLink(userId: string): Promise<{ url: string; expiresAt: string }> {
    if (!env.TELEGRAM_BOT_USERNAME) {
      throw new ValidationError('Telegram bot username is not configured on the server.');
    }

    // Invalidate existing unused tokens for this user
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

    const cleanBotUsername = env.TELEGRAM_BOT_USERNAME.replace(/^@/, '');
    const url = `https://t.me/${cleanBotUsername}?start=${rawToken}`;
    return { url, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Updates a user's Telegram username.
   */
  static async updateUsername(userId: string, username: string): Promise<void> {
    const normalized = username.trim().startsWith('@') ? username.trim() : `@${username.trim()}`;
    await prisma.user.update({
      where: { id: userId },
      data: { telegramUsername: normalized }
    });
  }

  /**
   * Updates a user's Telegram notification preferences.
   */
  static async updatePreferences(userId: string, input: UpdateNotificationPreferencesInput): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.notifyExpenseAdded !== undefined ? { notifyExpenseAdded: input.notifyExpenseAdded } : {}),
        ...(input.notifyMonthlySummary !== undefined ? { notifyMonthlySummary: input.notifyMonthlySummary } : {}),
        ...(input.notifySettlements !== undefined ? { notifySettlements: input.notifySettlements } : {}),
        ...(input.notifyPasswordReset !== undefined ? { notifyPasswordReset: input.notifyPasswordReset } : {})
      }
    });
  }

  /**
   * Disconnects a user's Telegram account.
   */
  static async disconnect(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramConnected: false,
        telegramConnectedAt: null
      }
    });
  }

  /**
   * Returns current webhook status directly from Telegram servers.
   */
  static async getWebhookInfo(): Promise<any> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not configured.' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
      return await res.json();
    } catch (err: any) {
      return {
        ok: false,
        error: err.message,
        cause: err.cause?.message || err.cause?.code || String(err.cause || '')
      };
    }
  }

  /**
   * Automatically registers the Telegram Webhook with Telegram servers in production.
   */
  static async autoRegisterWebhook(): Promise<{ success: boolean; url?: string; description?: string; error?: string }> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      logger.warn('Skipping Telegram webhook registration: TELEGRAM_BOT_TOKEN is empty.');
      return { success: false, error: 'TELEGRAM_BOT_TOKEN is empty' };
    }

    const publicUrl = env.API_URL?.replace(/\/$/, '');
    if (!publicUrl || publicUrl.includes('localhost') || publicUrl.includes('127.0.0.1')) {
      logger.debug('Skipping Telegram webhook auto-registration (local or missing API_URL)', { publicUrl });
      return { success: false, error: 'API_URL is local or not set' };
    }

    const webhookUrl = `${publicUrl}/api/telegram/webhook`;
    const body: Record<string, any> = {
      url: webhookUrl,
      drop_pending_updates: false
    };
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      body.secret_token = env.TELEGRAM_WEBHOOK_SECRET;
    }

    // Wait 2.5s on startup so container DNS and network interfaces are fully ready
    await new Promise((resolve) => setTimeout(resolve, 2500));

    let lastError = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = (await res.json().catch(() => ({}))) as any;
        if (data.ok) {
          logger.info('🤖 Telegram webhook registered successfully', { url: webhookUrl });
          return { success: true, url: webhookUrl, description: data.description };
        } else {
          logger.warn('Failed to auto-register Telegram webhook', {
            description: data.description,
            attempt
          });
          lastError = data.description || 'Telegram rejected webhook';
        }
      } catch (err: any) {
        lastError = err.message;
        const causeMsg = err.cause?.message || err.cause?.code || String(err.cause || '');
        logger.error(`Error auto-registering Telegram webhook (attempt ${attempt}/3)`, {
          error: err.message,
          cause: causeMsg
        });
      }

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    return { success: false, url: webhookUrl, error: lastError };
  }

  /**
   * Sends an outbound HTML text message to a specific Telegram chat ID.
   */
  static async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      logger.debug('[TELEGRAM SIMULATOR] Outbound message simulated');
      return true;
    }

    try {
      let response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      });

      // If Telegram rejects HTML entities (e.g. localhost URLs or special tags), retry cleanly as plain text
      if (!response.ok && response.status === 400) {
        const plainText = text.replace(/<[^>]*>/g, '');
        response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: plainText,
            disable_web_page_preview: false
          })
        });
      }

      if (!response.ok) {
        logger.warn('Telegram notification delivery failed', { statusCode: response.status });
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Telegram network error during sendMessage', { error: (err as Error).message });
      return false;
    }
  }

  /**
   * Handles incoming webhook updates from Telegram Bot API.
   * Processes /start <link-token> to safely associate chat_id with the authenticated account.
   */
  static async handleWebhook(update: any, secretHeader?: string, isPolling = false): Promise<void> {
    // Verify secret token if configured and coming from an external HTTP webhook
    if (!isPolling && env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      throw new UnauthorizedError('Invalid Telegram webhook secret token');
    }

    const message = update?.message;
    if (!message || !message.text) {
      return; // Ignore non-text updates
    }

    const text = message.text.trim();
    const chatId = String(message.chat.id);
    const senderUsername = message.from?.username ? `@${message.from.username}` : null;

    // Check for deep link command: /start <token>
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        await this.sendMessage(
          chatId,
          `👋 Welcome to <b>Splitwise Private</b>!\n\nTo connect your account, please click the <b>Connect Telegram</b> button on your dashboard or profile.`
        );
        return;
      }

      const rawToken = parts[1].trim();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const tokenRecord = await prisma.telegramConnectToken.findUnique({
        where: { tokenHash },
        include: { user: true }
      });

      if (!tokenRecord || tokenRecord.usedAt !== null || tokenRecord.expiresAt < new Date()) {
        await this.sendMessage(
          chatId,
          `⚠️ This connection link has expired or has already been used. Please generate a fresh link from the app.`
        );
        return;
      }

      // Check if this Telegram chat ID is already connected to another user
      const existingUserWithChatId = await prisma.user.findUnique({
        where: { telegramChatId: chatId }
      });

      if (existingUserWithChatId && existingUserWithChatId.id !== tokenRecord.userId) {
        // Disconnect previous account
        await prisma.user.update({
          where: { id: existingUserWithChatId.id },
          data: {
            telegramChatId: null,
            telegramConnected: false,
            telegramConnectedAt: null
          }
        });
      }

      // Associate Telegram Chat ID with the user
      await prisma.$transaction([
        prisma.user.update({
          where: { id: tokenRecord.userId },
          data: {
            telegramChatId: chatId,
            telegramUsername: senderUsername || tokenRecord.user.telegramUsername,
            telegramConnected: true,
            telegramConnectedAt: new Date()
          }
        }),
        prisma.telegramConnectToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() }
        })
      ]);

      await this.sendMessage(
        chatId,
        `🎉 <b>Success!</b> Your Telegram account has been connected to <b>${tokenRecord.user.name}</b>.\n\nYou will now receive instant expense notifications, settlement updates, and monthly summaries directly here.`
      );

      logger.info('Telegram account connected successfully', {
        userId: tokenRecord.userId
      });
    }
  }

  /**
   * Asynchronously dispatches expense notifications to all connected participants.
   * Safe post-commit hook: Never fails or rolls back transactions if delivery fails.
   */
  static async notifyExpenseAdded(expenseId: string): Promise<void> {
    try {
      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: {
          group: true,
          trip: true,
          payer: true,
          splits: {
            include: { user: true }
          }
        }
      });

      if (!expense) return;

      const formattedTotal = formatCurrency(expense.totalAmount);
      const formattedDate = new Date(expense.expenseDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const isGroup = !!expense.group;
      const isTrip = !!expense.trip;
      const spaceHeader = isTrip
        ? `🌴 <b>${expense.trip!.name}</b>\n\n`
        : isGroup
        ? `🏝️ <b>${expense.group!.name}</b>\n\n`
        : '';

      // 1. Notify Payer (if connected and preference is ON)
      if (
        expense.payer.telegramConnected &&
        expense.payer.telegramChatId &&
        expense.payer.notifyExpenseAdded !== false
      ) {
        const payerSplit = expense.splits.find((s) => s.userId === expense.paidBy);
        const payerShare = payerSplit ? payerSplit.amountOwed : 0;

        // Build list of who owes payer from this expense
        const debtors = expense.splits
          .filter((s) => s.userId !== expense.paidBy && s.amountOwed > 0)
          .map((s) => `${s.user.name} owes you: ${formatCurrency(s.amountOwed)}`);

        const debtorLines = debtors.length > 0 ? debtors.join('\n') : 'All settled in bill';
        const payerMsg = [
          `${spaceHeader}💸 <b>Expense Added</b>\n`,
          `<b>${expense.description}</b>`,
          `📅 Date: ${formattedDate}`,
          `Total: ${formattedTotal}`,
          `You paid: ${formattedTotal}`,
          `Your share: ${formatCurrency(payerShare)}\n`,
          debtorLines
        ].join('\n');

        await this.sendMessage(expense.payer.telegramChatId, payerMsg);
      }

      // 2. Notify other participants (if connected and preference is ON)
      for (const split of expense.splits) {
        if (split.userId === expense.paidBy) continue; // Payer already notified

        const user = split.user;
        if (user.telegramConnected && user.telegramChatId && user.notifyExpenseAdded !== false) {
          const formattedShare = formatCurrency(split.amountOwed);

          const participantMsg = [
            `${spaceHeader}💸 <b>New Expense</b>\n`,
            `<b>${expense.description}</b>`,
            `📅 Date: ${formattedDate}`,
            `Total: ${formattedTotal}`,
            `Paid by: ${expense.payer.name}\n`,
            `Your share: ${formattedShare}`,
            `You owe ${expense.payer.name}: ${formattedShare}`
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

  /**
   * Asynchronously dispatches settlement notification to both parties.
   */
  static async notifySettlement(settlementId: string): Promise<void> {
    try {
      const settlement = await prisma.settlement.findUnique({
        where: { id: settlementId },
        include: {
          fromUser: true,
          toUser: true
        }
      });

      if (!settlement) return;

      const formattedAmount = formatCurrency(settlement.amount);
      const noteLine = settlement.note ? `\nNote: <i>${settlement.note}</i>` : '';

      // 1. Notify Payer (fromUser)
      if (
        settlement.fromUser.telegramConnected &&
        settlement.fromUser.telegramChatId &&
        settlement.fromUser.notifySettlements !== false
      ) {
        const msg = [
          `🤝 <b>Settlement Recorded</b>\n`,
          `You paid <b>${settlement.toUser.name}</b> ${formattedAmount}.${noteLine}`
        ].join('\n');

        await this.sendMessage(settlement.fromUser.telegramChatId, msg);
      }

      // 2. Notify Receiver (toUser)
      if (
        settlement.toUser.telegramConnected &&
        settlement.toUser.telegramChatId &&
        settlement.toUser.notifySettlements !== false
      ) {
        const msg = [
          `🤝 <b>Settlement Received</b>\n`,
          `<b>${settlement.fromUser.name}</b> paid you ${formattedAmount}.${noteLine}`
        ].join('\n');

        await this.sendMessage(settlement.toUser.telegramChatId, msg);
      }
    } catch (err) {
      logger.error('Failed to dispatch settlement Telegram notifications', {
        settlementId,
        error: (err as Error).message
      });
    }
  }

  /**
   * Dispatches password reset notification via Telegram.
   */
  static async sendPasswordReset(user: { id: string; name: string; telegramChatId: string }, rawToken: string): Promise<boolean> {
    const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;

    const message = [
      `🔐 <b>Password Reset</b>\n`,
      `A password reset was requested for your account.\n`,
      `This link expires in 15 minutes.\n`,
      `🔗 <b>Reset Link:</b>`,
      `${resetUrl}\n`,
      `If you did not request this, you can safely ignore this message.`
    ].join('\n');

    return this.sendMessage(user.telegramChatId, message);
  }
}
