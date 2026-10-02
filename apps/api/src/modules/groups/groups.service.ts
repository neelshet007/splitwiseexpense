import { prisma } from '@splitwise/database';
import { AuthService } from '../auth/auth.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { CreateGroupInput, AddMemberInput } from '@splitwise/validation';
import { GroupItem } from '@splitwise/types';

export class GroupsService {
  private static formatGroup(group: any): GroupItem {
    return {
      id: group.id,
      name: group.name,
      createdBy: group.createdBy,
      createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt,
      updatedAt: group.updatedAt instanceof Date ? group.updatedAt.toISOString() : group.updatedAt,
      members: (group.members || []).map((m: any) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : m.joinedAt,
        user: AuthService.toSafeUser(m.user)
      })),
      _count: group._count
    };
  }

  static async createGroup(userId: string, data: CreateGroupInput): Promise<GroupItem> {
    const group = await prisma.group.create({
      data: {
        name: data.name.trim(),
        createdBy: userId,
        members: {
          create: [{ userId }]
        }
      },
      include: {
        members: {
          include: { user: true }
        },
        _count: {
          select: { expenses: true, members: true }
        }
      }
    });

    return this.formatGroup(group);
  }

  static async listUserGroups(userId: string): Promise<GroupItem[]> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: { user: true }
            },
            _count: {
              select: { expenses: true, members: true }
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    return memberships.map((m) => this.formatGroup(m.group));
  }

  static async getGroupById(groupId: string): Promise<GroupItem> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: true }
        },
        _count: {
          select: { expenses: true, members: true }
        }
      }
    });

    if (!group) {
      throw new NotFoundError('Group not found');
    }

    return this.formatGroup(group);
  }

  static async addMember(groupId: string, data: AddMemberInput): Promise<GroupItem> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!targetUser) {
      throw new NotFoundError(`No user found with email "${normalizedEmail}". Please have them register first.`);
    }

    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUser.id
        }
      }
    });

    if (existingMember) {
      throw new ConflictError(`${targetUser.name} is already a member of this group.`);
    }

    await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUser.id
      }
    });

    return this.getGroupById(groupId);
  }

  static async removeMember(groupId: string, memberUserId: string, requesterUserId: string): Promise<void> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true }
    });

    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Only group creator can remove other members, or a user can remove themselves
    if (requesterUserId !== group.createdBy && requesterUserId !== memberUserId) {
      throw new ForbiddenError('Only the group creator can remove other members.');
    }

    // Check if the member has unsettled expenses
    const paidExpensesCount = await prisma.expense.count({
      where: { groupId, paidBy: memberUserId }
    });

    const splitCount = await prisma.expenseSplit.count({
      where: {
        userId: memberUserId,
        expense: { groupId }
      }
    });

    if (paidExpensesCount > 0 || splitCount > 0) {
      throw new ValidationError('Cannot remove a member who has recorded expenses or liabilities in this group.');
    }

    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: memberUserId
        }
      }
    });
  }
}
