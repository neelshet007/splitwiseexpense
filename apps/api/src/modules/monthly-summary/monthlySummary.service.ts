import { prisma } from '@splitwise/database';
import { logger } from '../../utils/logger';
import { formatCurrency } from '../../utils/currency';
import { SettlementService } from '../balances/settlements.service';
import { TelegramService } from '../telegram/telegram.service';
import { UserBalance } from '@splitwise/types';

export class MonthlySummaryService {
  /**
   * Calculates and dispatches monthly financial summaries to connected Telegram users.
   * Completely idempotent: Uses MonthlySummaryLog to ensure accidental re-runs do not duplicate messages.
   */
  static async runMonthlySummary(targetYearMonth?: string): Promise<{ groupsProcessed: number; summariesSent: number }> {
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

    const groups = await prisma.group.findMany({
      include: {
        members: {
          include: { user: true }
        }
      }
    });

    let groupsProcessed = 0;
    let summariesSent = 0;

    for (const group of groups) {
      // 1. Idempotency Check: Check if this group was already processed for this month
      const existingLog = await prisma.monthlySummaryLog.findUnique({
        where: {
          groupId_yearMonth: {
            groupId: group.id,
            yearMonth
          }
        }
      });

      if (existingLog) {
        logger.info(`Skipping already-summarized group ${group.name} for ${yearMonth}`);
        continue;
      }

      // 2. Fetch expenses within this month
      const monthlyExpenses = await prisma.expense.findMany({
        where: {
          groupId: group.id,
          expenseDate: {
            gte: startDate,
            lt: endDate
          }
        },
        include: {
          splits: true
        }
      });

      if (monthlyExpenses.length === 0) {
        // Log idempotency record even if empty, so we don't re-scan
        await prisma.monthlySummaryLog.create({
          data: { groupId: group.id, yearMonth }
        });
        continue;
      }

      // 3. Compute balances for this month
      let totalGroupExpenses = 0;
      const balanceMap = new Map<string, { userId: string; userName: string; email: string; totalPaid: number; totalShare: number }>();

      for (const m of group.members) {
        balanceMap.set(m.userId, {
          userId: m.userId,
          userName: m.user.name,
          email: m.user.email,
          totalPaid: 0,
          totalShare: 0
        });
      }

      for (const exp of monthlyExpenses) {
        totalGroupExpenses += exp.totalAmount;
        const payer = balanceMap.get(exp.paidBy);
        if (payer) payer.totalPaid += exp.totalAmount;

        for (const sp of exp.splits) {
          const participant = balanceMap.get(sp.userId);
          if (participant) participant.totalShare += sp.amountOwed;
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

      // Calculate simplified settlements
      const settlements = SettlementService.simplifyDebts(balances);

      // 4. Send personalized summary to each connected member
      for (const m of group.members) {
        const user = m.user;
        if (!user.telegramConnected || !user.telegramChatId) continue;

        const userBalance = balances.find((b) => b.userId === user.id);
        if (!userBalance) continue;

        const youAreOwed = userBalance.netBalance > 0 ? userBalance.netBalance : 0;
        const youOwe = userBalance.netBalance < 0 ? Math.abs(userBalance.netBalance) : 0;

        // Relevant settlements for this user
        const userSettlements = settlements.filter(
          (s) => s.fromUserId === user.id || s.toUserId === user.id
        );

        let settlementLines = '';
        if (userSettlements.length === 0) {
          settlementLines = 'All settled up! 🎉\n';
        } else {
          settlementLines = userSettlements
            .map((s) => {
              if (s.toUserId === user.id) {
                return `• ${s.fromUserName} → You ${formatCurrency(s.amount)}`;
              } else {
                return `• You → ${s.toUserName} ${formatCurrency(s.amount)}`;
              }
            })
            .join('\n');
        }

        const message = [
          `📊 <b>${monthName} Expense Summary</b>\n`,
          `<b>${group.name}</b>\n`,
          `You paid: ${formatCurrency(userBalance.totalPaid)}`,
          `Your share: ${formatCurrency(userBalance.totalShare)}\n`,
          `You are owed: ${formatCurrency(youAreOwed)}`,
          `You owe: ${formatCurrency(youOwe)}\n`,
          `<b>Settlement:</b>`,
          settlementLines,
          `\nTotal group expenses: ${formatCurrency(totalGroupExpenses)}`
        ].join('\n');

        await TelegramService.sendMessage(user.telegramChatId, message);
        summariesSent++;
      }

      // 5. Mark group as summarized for this month (idempotency key)
      await prisma.monthlySummaryLog.create({
        data: {
          groupId: group.id,
          yearMonth
        }
      });

      groupsProcessed++;
    }

    logger.info(`Monthly summary completed: ${groupsProcessed} groups processed, ${summariesSent} summaries sent.`);
    return { groupsProcessed, summariesSent };
  }
}
