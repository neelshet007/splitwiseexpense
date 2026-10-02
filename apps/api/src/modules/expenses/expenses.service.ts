import { prisma } from '@splitwise/database';
import { CreateExpenseInput, UpdateExpenseInput } from '@splitwise/validation';
import { ExpenseItem, SplitType } from '@splitwise/types';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { AuthService } from '../auth/auth.service';
import { TelegramService } from '../telegram/telegram.service';

export class ExpensesService {
  private static formatExpense(e: any): ExpenseItem {
    return {
      id: e.id,
      groupId: e.groupId,
      description: e.description,
      totalAmount: e.totalAmount,
      splitType: e.splitType as SplitType,
      paidBy: e.paidBy,
      createdBy: e.createdBy,
      expenseDate: e.expenseDate instanceof Date ? e.expenseDate.toISOString() : e.expenseDate,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
      updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt,
      payer: AuthService.toSafeUser(e.payer),
      creator: AuthService.toSafeUser(e.creator),
      splits: (e.splits || []).map((s: any) => ({
        id: s.id,
        expenseId: s.expenseId,
        userId: s.userId,
        amountOwed: s.amountOwed,
        user: s.user ? AuthService.toSafeUser(s.user) : undefined
      }))
    };
  }

  /**
   * Deterministic split calculator guaranteeing sum(amountOwed) === totalAmount.
   */
  static calculateSplits(
    totalAmount: number,
    splitType: SplitType,
    splits: { userId: string; amountOwed?: number; percentage?: number }[]
  ): { userId: string; amountOwed: number }[] {
    const count = splits.length;
    if (count === 0) {
      throw new ValidationError('At least one participant is required for expense splitting.');
    }

    if (splitType === 'EQUAL') {
      const baseShare = Math.floor(totalAmount / count);
      const remainder = totalAmount % count;

      return splits.map((s, index) => ({
        userId: s.userId,
        // Distribute remainder minor cents evenly to first N participants
        amountOwed: index < remainder ? baseShare + 1 : baseShare
      }));
    }

    if (splitType === 'EXACT') {
      const result = splits.map((s) => ({
        userId: s.userId,
        amountOwed: s.amountOwed ?? 0
      }));

      const sum = result.reduce((acc, curr) => acc + curr.amountOwed, 0);
      if (sum !== totalAmount) {
        throw new ValidationError(`Exact split total (${sum}) does not match expense total (${totalAmount}).`);
      }
      return result;
    }

    if (splitType === 'PERCENTAGE') {
      let allocatedSum = 0;
      let maxPercentIndex = 0;
      let maxPercentValue = -1;

      const result = splits.map((s, idx) => {
        const pct = s.percentage ?? 0;
        if (pct > maxPercentValue) {
          maxPercentValue = pct;
          maxPercentIndex = idx;
        }
        const amount = Math.round((pct / 100) * totalAmount);
        allocatedSum += amount;
        return {
          userId: s.userId,
          amountOwed: amount
        };
      });

      // Compensate for any penny roundoff discrepancy
      const discrepancy = totalAmount - allocatedSum;
      if (discrepancy !== 0 && result.length > 0) {
        result[maxPercentIndex].amountOwed += discrepancy;
      }

      return result;
    }

    throw new ValidationError(`Unsupported split type: ${splitType}`);
  }

  static async createExpense(
    groupId: string | null | undefined,
    createdByUserId: string,
    data: CreateExpenseInput
  ): Promise<ExpenseItem> {
    const targetGroupId = groupId || data.groupId || null;

    // 1. Validate Group (if group expense) or Participants (if direct expense) inside Transaction
    const createdExpense = await prisma.$transaction(async (tx) => {
      if (targetGroupId) {
        const group = await tx.group.findUnique({
          where: { id: targetGroupId },
          include: { members: true }
        });

        if (!group) {
          throw new NotFoundError('Group not found');
        }

        const memberIds = new Set(group.members.map((m) => m.userId));

        // Validate Payer
        if (!memberIds.has(data.paidBy)) {
          throw new ValidationError('Payer must be an active member of the group.');
        }

        // Validate all split participants
        for (const split of data.splits) {
          if (!memberIds.has(split.userId)) {
            throw new ValidationError(`User ${split.userId} is not an active member of this group.`);
          }
        }
      } else {
        // Direct friend expense: validate all users exist
        const userIds = [data.paidBy, ...data.splits.map((s) => s.userId)];
        const existingUsers = await tx.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true }
        });

        if (existingUsers.length !== new Set(userIds).size) {
          throw new ValidationError('One or more expense participants do not exist.');
        }
      }

      // Calculate final split amounts
      const finalizedSplits = this.calculateSplits(data.totalAmount, data.splitType, data.splits);

      return tx.expense.create({
        data: {
          groupId: targetGroupId,
          description: data.description.trim(),
          totalAmount: data.totalAmount,
          splitType: data.splitType,
          paidBy: data.paidBy,
          createdBy: createdByUserId,
          expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
          splits: {
            create: finalizedSplits
          }
        },
        include: {
          payer: true,
          creator: true,
          splits: {
            include: { user: true }
          }
        }
      });
    });

    // 2. Post-commit Telegram notification (non-blocking)
    setImmediate(() => {
      TelegramService.notifyExpenseAdded(createdExpense.id).catch(() => {});
    });

    return this.formatExpense(createdExpense);
  }

  static async getExpenseById(expenseId: string): Promise<ExpenseItem> {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        payer: true,
        creator: true,
        splits: {
          include: { user: true }
        }
      }
    });

    if (!expense) {
      throw new NotFoundError('Expense not found');
    }

    return this.formatExpense(expense);
  }

  static async listGroupExpenses(groupId: string, page = 1, limit = 20): Promise<{ expenses: ExpenseItem[]; total: number }> {
    const skip = (page - 1) * limit;

    const [total, expensesRaw] = await Promise.all([
      prisma.expense.count({ where: { groupId } }),
      prisma.expense.findMany({
        where: { groupId },
        include: {
          payer: true,
          creator: true,
          splits: {
            include: { user: true }
          }
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit
      })
    ]);

    return {
      expenses: expensesRaw.map((e) => this.formatExpense(e)),
      total
    };
  }

  static async updateExpense(
    expenseId: string,
    currentUserId: string,
    data: UpdateExpenseInput
  ): Promise<ExpenseItem> {
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { group: { include: { members: true } } }
    });

    if (!existing) {
      throw new NotFoundError('Expense not found');
    }

    if (existing.paidBy !== currentUserId && existing.createdBy !== currentUserId) {
      throw new ForbiddenError('Only the payer or creator can edit this expense.');
    }

    const isGroup = !!existing.group;
    const memberIds = isGroup ? new Set(existing.group!.members.map((m) => m.userId)) : null;
    const totalAmount = data.totalAmount ?? existing.totalAmount;
    const splitType = (data.splitType ?? existing.splitType) as SplitType;
    const paidBy = data.paidBy ?? existing.paidBy;

    if (memberIds && !memberIds.has(paidBy)) {
      throw new ValidationError('Payer must be an active member of the group.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      let splitUpdateData = undefined;

      if (data.splits) {
        if (memberIds) {
          for (const s of data.splits) {
            if (!memberIds.has(s.userId)) {
              throw new ValidationError(`User ${s.userId} is not a group member.`);
            }
          }
        }
        const finalized = this.calculateSplits(totalAmount, splitType, data.splits);

        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        splitUpdateData = {
          create: finalized
        };
      }

      return tx.expense.update({
        where: { id: expenseId },
        data: {
          description: data.description ? data.description.trim() : undefined,
          totalAmount,
          splitType,
          paidBy,
          expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
          splits: splitUpdateData
        },
        include: {
          payer: true,
          creator: true,
          splits: {
            include: { user: true }
          }
        }
      });
    });

    return this.formatExpense(updated);
  }

  static async deleteExpense(expenseId: string, currentUserId: string): Promise<void> {
    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { group: true }
    });

    if (!existing) {
      throw new NotFoundError('Expense not found');
    }

    const isGroupOwner = existing.group && existing.group.createdBy === currentUserId;

    if (
      existing.paidBy !== currentUserId &&
      existing.createdBy !== currentUserId &&
      !isGroupOwner
    ) {
      throw new ForbiddenError('Only the payer, creator, or group owner can delete this expense.');
    }

    await prisma.expense.delete({
      where: { id: expenseId }
    });
  }
}
