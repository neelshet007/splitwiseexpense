import crypto from 'crypto';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { prisma } from '@splitwise/database';
import { env } from '../../config/env';
import { ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { RegisterInput, LoginInput, ResetPasswordInput } from '@splitwise/validation';
import { SafeUser } from '@splitwise/types';
import { sendEmail } from '../../utils/email';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4
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
      sameSite: 'lax',
      maxAge: env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/'
    });
  }

  static clearSessionCookie(res: Response): void {
    res.clearCookie('session_token', {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
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

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash
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

    // Timing-attack safe generic failure
    if (!user) {
      // Fake verify to simulate constant time
      await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$fakeSalt$fakeHash', data.password).catch(() => {});
      throw new UnauthorizedError('Invalid email or password.');
    }

    const validPassword = await argon2.verify(user.passwordHash, data.password);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const token = this.generateSessionToken(user.id);
    return { user: this.toSafeUser(user), token };
  }

  static async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // If user does not exist, do not reveal it
    if (!user) {
      return;
    }

    // Invalidate prior unused tokens
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    const resetLink = `${env.APP_URL}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your password - Splitwise Private',
      text: `Hello ${user.name},\n\nYou requested a password reset. Click the link below to set a new password:\n\n${resetLink}\n\nThis link is valid for 1 hour. If you did not request this, please ignore this email.`,
      html: `<p>Hello ${user.name},</p><p>You requested a password reset for your account. Click the button below:</p><p><a href="${resetLink}" style="padding:10px 18px;background:#10b981;color:#fff;border-radius:6px;text-decoration:none;">Reset Password</a></p><p>Or copy this URL: ${resetLink}</p><p>This link expires in 1 hour.</p>`
    });
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
  }
}
