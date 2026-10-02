import { prisma } from '@splitwise/database';
import { GroupBalancesResponse, GroupSettlementsResponse, UserBalance, DashboardSummary } from '@splitwise/types';
import { NotFoundError } from '../../utils/errors';
import { SettlementService } from './settlements.service';
import { AuthService } from '../auth/auth.service';

export class BalanceService {
  static async calculateGroupBalances(groupId: string): Promise<GroupBalancesResponse> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: true }
        }
      }
    });

    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Get all expenses and their splits for this group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        splits: true
      }
    });

    let totalGroupExpenses = 0;

    // Initialize map for all members
    const balanceMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        email: string;
        totalPaid: number;
        totalShare: number;
      }
    >();

    for (const member of group.members) {
      balanceMap.set(member.userId, {
        userId: member.userId,
        userName: member.user.name,
        email: member.user.email,
        totalPaid: 0,
        totalShare: 0
      });
    }

    // Aggregate contributions & liabilities
    for (const expense of expenses) {
      totalGroupExpenses += expense.totalAmount;

      // Add to payer's paid total
      const payerEntry = balanceMap.get(expense.paidBy);
      if (payerEntry) {
        payerEntry.totalPaid += expense.totalAmount;
      }

      // Add to each participant's share
      for (const split of expense.splits) {
        const participantEntry = balanceMap.get(split.userId);
        if (participantEntry) {
          participantEntry.totalShare += split.amountOwed;
        }
      }
    }

    const balances: UserBalance[] = Array.from(balanceMap.values()).map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      email: entry.email,
      totalPaid: entry.totalPaid,
      totalShare: entry.totalShare,
      netBalance: entry.totalPaid - entry.totalShare
    }));

    return {
      groupId,
      totalExpenses: totalGroupExpenses,
      balances
    };
  }

  static async calculateGroupSettlements(groupId: string): Promise<GroupSettlementsResponse> {
    const { balances } = await this.calculateGroupBalances(groupId);
    const settlements = SettlementService.simplifyDebts(balances);

    return {
      groupId,
      settlements
    };
  }

  static async getUserDashboardSummary(userId: string): Promise<DashboardSummary> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Find all groups user belongs to
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
      }
    });

    const groups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      createdBy: m.group.createdBy,
      createdAt: m.group.createdAt.toISOString(),
      updatedAt: m.group.updatedAt.toISOString(),
      members: m.group.members.map((gm) => ({
        id: gm.id,
        groupId: gm.groupId,
        userId: gm.userId,
        joinedAt: gm.joinedAt.toISOString(),
        user: AuthService.toSafeUser(gm.user)
      })),
      _count: m.group._count
    }));

    const groupIds = groups.map((g) => g.id);

    // Calculate aggregated group balances
    let totalPaid = 0;
    let totalOwedToYou = 0;
    let totalYouOwe = 0;

    for (const group of groups) {
      const { balances } = await this.calculateGroupBalances(group.id);
      const userBalance = balances.find((b) => b.userId === userId);

      if (userBalance) {
        totalPaid += userBalance.totalPaid;
        if (userBalance.netBalance > 0) {
          totalOwedToYou += userBalance.netBalance;
        } else if (userBalance.netBalance < 0) {
          totalYouOwe += Math.abs(userBalance.netBalance);
        }
      }
    }

    // Direct 1-to-1 Friends Balances
    const { FriendsService } = await import('../friends/friends.service');
    const friends = await FriendsService.listFriends(userId);

    for (const friend of friends) {
      totalPaid += friend.totalPaid;
      if (friend.netBalance > 0) {
        totalOwedToYou += friend.netBalance;
      } else if (friend.netBalance < 0) {
        totalYouOwe += Math.abs(friend.netBalance);
      }
    }

    // Recent 10 expenses across user's groups & direct friend splits
    const recentExpensesRaw = await prisma.expense.findMany({
      where: {
        OR: [
          { groupId: { in: groupIds } },
          { groupId: null, splits: { some: { userId } } }
        ]
      },
      include: {
        payer: true,
        creator: true,
        splits: {
          include: { user: true }
        }
      },
      orderBy: { expenseDate: 'desc' },
      take: 10
    });

    const recentExpenses = recentExpensesRaw.map((e) => ({
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

    return {
      user: AuthService.toSafeUser(user),
      totalPaid,
      totalOwedToYou,
      totalYouOwe,
      netBalance: totalOwedToYou - totalYouOwe,
      recentExpenses,
      groups,
      friends
    };
  }
}
