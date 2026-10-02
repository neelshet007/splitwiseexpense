import { Response, NextFunction } from 'express';
import { prisma } from '@splitwise/database';
import { AuthenticatedRequest } from './auth.middleware';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export interface GroupRequest extends AuthenticatedRequest {
  groupMembership?: {
    id: string;
    groupId: string;
    userId: string;
  };
}

export async function requireGroupMember(req: GroupRequest, res: Response, next: NextFunction) {
  try {
    const rawGroupId = req.params.groupId || req.body.groupId;
    const groupId = rawGroupId ? String(rawGroupId) : undefined;
    const userId = req.user?.id;

    if (!groupId) {
      throw new NotFoundError('Group ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('Unauthorized');
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!membership) {
      throw new ForbiddenError('Access denied. You are not a member of this group.');
    }

    req.groupMembership = membership;
    next();
  } catch (error) {
    next(error);
  }
}
