import { prisma } from '@splitwise/database';
import { logger } from '../../utils/logger';
import { formatCurrency } from '../../utils/currency';
import { TelegramService } from '../telegram/telegram.service';
import { FriendsService } from '../friends/friends.service';

export class MonthlySummaryService {
  /**
   * Calculates and dispatches personal monthly financial summaries to connected Telegram users.
   * Completely idempotent: Uses NotificationLog (userId, type, period) to prevent duplicate messages.
   */
  static async runMonthlySummary(targetYearMonth?: string): Promise<{ usersProcessed: number; summariesSent: number }> {
    const now = new Date();
    // Default to preceding month if not specified
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed: current month - 1 = previous month

    if (month === 0) {
      year -= 1;
      month = 12;
    }

    const yearMonth = targetYearMonth || `${year}-${String(month).padStart(2, '0')}`;
    const [targetYear, targetMonth] = yearMonth.split('-').map(Number);

    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const endDate = new Date(Date.UTC(targetYear, targetMonth, 1));

    const monthName = startDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

    logger.info(`Running monthly summary job for ${monthName} ${targetYear} (${yearMonth})`);

    // Fetch all users with Telegram connected and monthly summary notification enabled
    const users = await prisma.user.findMany({
      where: {
        telegramConnected: true,
        telegramChatId: { not: null },
        notifyMonthlySummary: true
      },
      include: {
        friendshipsRequested: { where: { status: 'ACCEPTED' }, include: { receiver: true } },
        friendshipsReceived: { where: { status: 'ACCEPTED' }, include: { requester: true } }
      }
    });

    let usersProcessed = 0;
    let summariesSent = 0;

    for (const user of users) {
      // 1. Idempotency Check: Check if user was already sent a summary for this period
      const existingLog = await prisma.notificationLog.findUnique({
        where: {
          userId_type_period: {
            userId: user.id,
            type: 'MONTHLY_SUMMARY',
            period: yearMonth
          }
        }
      });

      if (existingLog) {
        logger.debug('Skipping already-summarized user for period', { userId: user.id, period: yearMonth });
        continue;
      }

      // 2. Fetch expenses in the month involving this user
      const monthlyExpenses = await prisma.expense.findMany({
        where: {
          expenseDate: {
            gte: startDate,
            lt: endDate
          },
          OR: [
            { paidBy: user.id },
            { splits: { some: { userId: user.id } } }
          ]
        },
        include: {
          splits: true
        }
      });

      let totalExpenses = 0;
      let totalPaid = 0;
      let totalShare = 0;

      for (const exp of monthlyExpenses) {
        totalExpenses += exp.totalAmount;
        if (exp.paidBy === user.id) {
          totalPaid += exp.totalAmount;
        }
        const userSplit = exp.splits.find((s) => s.userId === user.id);
        if (userSplit) {
          totalShare += userSplit.amountOwed;
        }
      }

      // 3. Compute overall bilateral balances across all friends
      const friendsList = [
        ...user.friendshipsRequested.map((f) => f.receiver),
        ...user.friendshipsReceived.map((f) => f.requester)
      ];

      const whoOwesYou: { name: string; amount: number }[] = [];
      const youOwe: { name: string; amount: number }[] = [];

      for (const friend of friendsList) {
        const { netBalance } = await FriendsService.calculateRelationshipFinancials(user.id, friend.id);
        if (netBalance > 0) {
          whoOwesYou.push({ name: friend.name, amount: netBalance });
        } else if (netBalance < 0) {
          youOwe.push({ name: friend.name, amount: Math.abs(netBalance) });
        }
      }

      const totalOwedToYou = whoOwesYou.reduce((acc, curr) => acc + curr.amount, 0);
      const totalYouOwe = youOwe.reduce((acc, curr) => acc + curr.amount, 0);

      // 4. Format personalized Telegram message matching Section 11
      const whoOwesYouBlock =
        whoOwesYou.length > 0
          ? `People who owe you:\n\n` +
            whoOwesYou.map((p) => `${p.name}\n${formatCurrency(p.amount)}`).join('\n\n')
          : `People who owe you:\nNobody`;

      const youOweBlock =
        youOwe.length > 0
          ? `You owe:\n\n` +
            youOwe.map((p) => `${p.name}\n${formatCurrency(p.amount)}`).join('\n\n')
          : `You owe:\nNobody 🎉`;

      const message = [
        `📊 <b>${monthName} Expense Summary</b>\n`,
        `Total expenses:\n${formatCurrency(totalExpenses)}\n`,
        `You paid:\n${formatCurrency(totalPaid)}\n`,
        `Your share:\n${formatCurrency(totalShare)}\n`,
        `You are owed:\n${formatCurrency(totalOwedToYou)}\n`,
        `You owe:\n${formatCurrency(totalYouOwe)}\n`,
        `────────────────\n`,
        whoOwesYouBlock + `\n`,
        `────────────────\n`,
        youOweBlock
      ].join('\n');

      const sent = await TelegramService.sendMessage(user.telegramChatId!, message);

      // 5. Store idempotency record in NotificationLog
      await prisma.notificationLog.create({
        data: {
          userId: user.id,
          type: 'MONTHLY_SUMMARY',
          period: yearMonth,
          status: sent ? 'SENT' : 'FAILED',
          sentAt: sent ? new Date() : null
        }
      });

      if (sent) summariesSent++;
      usersProcessed++;
    }

    logger.info(`Monthly summary completed: ${usersProcessed} users processed, ${summariesSent} summaries sent.`);
    return { usersProcessed, summariesSent };
  }
}
