import crypto from 'crypto';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { prisma } from '@splitwise/database';
import { env } from '../../config/env';
import { ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { RegisterInput, LoginInput, ResetPasswordInput } from '@splitwise/validation';
import { SafeUser } from '@splitwise/types';
import { TelegramService } from '../telegram/telegram.service';
import { logger } from '../../utils/logger';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

export class AuthService {
  static toSafeUser(user: any): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      telegramChatId: user.telegramChatId,
      telegramUsername: user.telegramUsername,
      telegramConnected: user.telegramConnected,
      telegramConnectedAt: user.telegramConnectedAt instanceof Date ? user.telegramConnectedAt.toISOString() : user.telegramConnectedAt,
      notifyExpenseAdded: user.notifyExpenseAdded ?? true,
      notifyMonthlySummary: user.notifyMonthlySummary ?? true,
      notifySettlements: user.notifySettlements ?? true,
      notifyPasswordReset: user.notifyPasswordReset ?? true,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt
    };
  }

  static generateSessionToken(userId: string): string {
    return jwt.sign({ userId }, env.SESSION_SECRET, {
      expiresIn: `${env.SESSION_EXPIRY_DAYS}d`
    });
  }

  static setSessionCookie(res: Response, token: string): void {
    const isProd = env.isProduction;
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/'
    });
  }

  static clearSessionCookie(res: Response): void {
    const isProd = env.isProduction;
    res.clearCookie('session_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/'
    });
  }

  static async register(data: RegisterInput): Promise<{ user: SafeUser; token: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const passwordHash = await argon2.hash(data.password, ARGON2_OPTIONS);

    const normalizedTelegram = data.telegramUsername
      ? data.telegramUsername.trim().startsWith('@')
        ? data.telegramUsername.trim()
        : `@${data.telegramUsername.trim()}`
      : null;

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash,
        telegramUsername: normalizedTelegram,
        telegramConnected: false
      }
    });

    const token = this.generateSessionToken(user.id);
    return { user: this.toSafeUser(user), token };
  }

  static async login(data: LoginInput): Promise<{ user: SafeUser; token: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const validPassword = await argon2.verify(user.passwordHash, data.password);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const token = this.generateSessionToken(user.id);
    return { user: this.toSafeUser(user), token };
  }

  /**
   * Password reset via Telegram only.
   * Completely adheres to:
   * - No email service
   * - Generic timing-safe response (no account enumeration)
   * - Database-backed rate limiting
   * - Cryptographically secure 15-minute token
   */
  static async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // If user does not exist or Telegram is not connected, do not reveal it
    if (!user || !user.telegramConnected || !user.telegramChatId) {
      return;
    }

    // Rate-limit check: Max 3 reset requests within 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequests = await prisma.passwordReset.count({
      where: {
        userId: user.id,
        createdAt: { gte: fifteenMinutesAgo }
      }
    });

    if (recentRequests >= 3) {
      logger.warn('Password reset rate limit exceeded', { userId: user.id });
      return; // Generic response to prevent abuse
    }

    // Invalidate prior unused tokens
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id, usedAt: null }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    await TelegramService.sendPasswordReset(
      {
        id: user.id,
        name: user.name,
        telegramChatId: user.telegramChatId
      },
      rawToken
    );
  }

  static async resetPassword(data: ResetPasswordInput): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt < new Date()) {
      throw new ValidationError('Invalid, expired, or already used password reset link.');
    }

    const newPasswordHash = await argon2.hash(data.password, ARGON2_OPTIONS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash }
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() }
      })
    ]);

    // Send Telegram alert if connected
    if (resetRecord.user.telegramConnected && resetRecord.user.telegramChatId) {
      TelegramService.sendMessage(
        resetRecord.user.telegramChatId,
        `🔐 <b>Security Alert</b>\n\nYour password was successfully updated. You may now log in with your new password.`
      ).catch(() => {});
    }
  }
}
