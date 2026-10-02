import { prisma } from '@splitwise/database';
import { AuthService } from '../auth/auth.service';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { FriendItem, ExpenseItem } from '@splitwise/types';
import { ExpensesService } from '../expenses/expenses.service';

export class FriendsService {
  /**
   * Retrieves all friends of a user with direct 1-to-1 financial balances.
   */
  static async listFriends(userId: string): Promise<FriendItem[]> {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: 'ACCEPTED'
      },
      include: {
        requester: true,
        receiver: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const friendItems: FriendItem[] = [];

    for (const f of friendships) {
      const isRequester = f.requesterId === userId;
      const friendUser = isRequester ? f.receiver : f.requester;
      const friendId = friendUser.id;

      // Compute direct 1-to-1 expenses between these two users (groupId is null)
      const directExpenses = await prisma.expense.findMany({
        where: {
          groupId: null,
          splits: {
            some: { userId }
          },
          OR: [
            { paidBy: userId },
            { paidBy: friendId }
          ]
        },
        include: {
          splits: true
        }
      });

      let totalPaid = 0;
      let totalShare = 0;

      for (const exp of directExpenses) {
        // Did the current user pay?
        if (exp.paidBy === userId) {
          totalPaid += exp.totalAmount;
        }

        // Current user's share in this expense
        const mySplit = exp.splits.find((s) => s.userId === userId);
        if (mySplit) {
          totalShare += mySplit.amountOwed;
        }
      }

      const netBalance = totalPaid - totalShare;

      friendItems.push({
        id: f.id,
        friendId,
        friend: AuthService.toSafeUser(friendUser),
        netBalance,
        totalPaid,
        totalShare,
        status: f.status
      });
    }

    return friendItems;
  }

  /**
   * Adds a friend by email. Verifies the user actually exists in the database.
   */
  static async addFriend(userId: string, email: string): Promise<FriendItem> {
    const normalizedEmail = email.toLowerCase().trim();

    const targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!targetUser) {
      throw new NotFoundError(`No account found with this email: ${normalizedEmail}`);
    }

    if (targetUser.id === userId) {
      throw new ValidationError('You cannot add yourself as a friend.');
    }

    // Check existing friendship in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId: targetUser.id },
          { requesterId: targetUser.id, receiverId: userId }
        ]
      }
    });

    if (existing) {
      throw new ConflictError(`${targetUser.name} is already in your friends list.`);
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId: userId,
        receiverId: targetUser.id,
        status: 'ACCEPTED'
      },
      include: {
        receiver: true
      }
    });

    return {
      id: friendship.id,
      friendId: targetUser.id,
      friend: AuthService.toSafeUser(targetUser),
      netBalance: 0,
      totalPaid: 0,
      totalShare: 0,
      status: friendship.status
    };
  }

  /**
   * Returns all direct expenses between two friends.
   */
  static async getDirectExpenses(userId: string, friendId: string): Promise<ExpenseItem[]> {
    const expenses = await prisma.expense.findMany({
      where: {
        groupId: null,
        AND: [
          { splits: { some: { userId } } },
          { splits: { some: { userId: friendId } } }
        ]
      },
      include: {
        payer: true,
        creator: true,
        splits: {
          include: { user: true }
        }
      },
      orderBy: { expenseDate: 'desc' }
    });

    return expenses.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      description: e.description,
      totalAmount: e.totalAmount,
      splitType: e.splitType as any,
      paidBy: e.paidBy,
      createdBy: e.createdBy,
      expenseDate: e.expenseDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      payer: AuthService.toSafeUser(e.payer),
      creator: AuthService.toSafeUser(e.creator),
      splits: e.splits.map((s) => ({
        id: s.id,
        expenseId: s.expenseId,
        userId: s.userId,
        amountOwed: s.amountOwed,
        user: AuthService.toSafeUser(s.user)
      }))
    }));
  }
}
