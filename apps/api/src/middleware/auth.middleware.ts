import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '@splitwise/database';
import { UnauthorizedError } from '../utils/errors';
import { SafeUser } from '@splitwise/types';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

interface JwtPayload {
  userId: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedError('Authentication required. Please log in.');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.SESSION_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired session. Please log in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        telegramChatId: true,
        telegramUsername: true,
        telegramConnected: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new UnauthorizedError('User account not found.');
    }

    req.user = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.session_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next();

    const decoded = jwt.verify(token, env.SESSION_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        telegramChatId: true,
        telegramUsername: true,
        telegramConnected: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (user) {
      req.user = {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      };
    }
  } catch {
    // Ignore token errors for optional auth
  }
  next();
}
