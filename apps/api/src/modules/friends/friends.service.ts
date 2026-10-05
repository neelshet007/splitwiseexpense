import { prisma } from '@splitwise/database';
import { AuthService } from '../auth/auth.service';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import { FriendItem, ExpenseItem, FriendRelationshipDetails, FriendRelationshipExpenseItem, SettlementItem } from '@splitwise/types';
import { CreateSettlementInput } from '@splitwise/validation';
import ExcelJS from 'exceljs';
import { TelegramService } from '../telegram/telegram.service';

export class FriendsService {
  /**
   * Helper to verify friendship exists and is ACCEPTED.
   * Throws NotFoundError if no active friendship exists.
   */
  static async getFriendshipOrThrow(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new ValidationError('A user cannot have a friend relationship with themselves.');
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId: friendId },
          { requesterId: friendId, receiverId: userId }
        ],
        status: 'ACCEPTED'
      },
      include: {
        requester: true,
        receiver: true
      }
    });

    if (!friendship) {
      throw new NotFoundError('Friend relationship not found or has not been accepted.');
    }

    const friendUser = friendship.requesterId === userId ? friendship.receiver : friendship.requester;
    return { friendship, friendUser };
  }

  /**
   * Parses human-readable date filters into Date objects.
   */
  static parseDateRange(range?: string, startDateStr?: string, endDateStr?: string): { startDate?: Date; endDate?: Date; label: string } {
    const now = new Date();
    if (range === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = `This Month (${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`;
      return { startDate: start, endDate: end, label };
    }
    if (range === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      const label = `Last Month (${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`;
      return { startDate: start, endDate: end, label };
    }
    if (range === 'last_3_months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return { startDate: start, endDate: now, label: 'Last 3 Months' };
    }
    if (range === 'custom' && (startDateStr || endDateStr)) {
      const start = startDateStr ? new Date(startDateStr) : undefined;
      const end = endDateStr ? new Date(endDateStr) : undefined;
      return { startDate: start, endDate: end, label: `Custom (${startDateStr || ''} to ${endDateStr || ''})` };
    }
    return { label: 'All Time' };
  }

  /**
   * Core Bilateral Financial Calculation Engine between two users.
   * Calculates:
   * - Bilateral net balance
   * - Relevant expenses (direct & bilateral portion of group expenses)
   * - Relevant settlements
   * - User paid, friend paid, user share, friend share, total expenses
   */
  static async calculateRelationshipFinancials(
    userId: string,
    friendId: string,
    options?: { startDate?: Date; endDate?: Date }
  ) {
    const { startDate, endDate } = options || {};

    // 1. Fetch relevant expenses between user and friend:
    // Only include expenses where:
    // - User paid AND Friend is in splits (Friend owes User)
    // OR
    // - Friend paid AND User is in splits (User owes Friend)
    const expenseWhere: any = {
      AND: [
        {
          OR: [
            {
              paidBy: userId,
              splits: { some: { userId: friendId } }
            },
            {
              paidBy: friendId,
              splits: { some: { userId } }
            }
          ]
        }
      ]
    };

    if (startDate || endDate) {
      expenseWhere.AND.push({
        expenseDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {})
        }
      });
    }

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      include: {
        payer: true,
        creator: true,
        group: true,
        splits: {
          include: { user: true }
        }
      },
      orderBy: { expenseDate: 'desc' }
    });

    // 2. Fetch all settlements between these two users
    const settlementWhere: any = {
      OR: [
        { fromUserId: userId, toUserId: friendId },
        { fromUserId: friendId, toUserId: userId }
      ]
    };

    if (startDate || endDate) {
      settlementWhere.settledAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      };
    }

    const settlements = await prisma.settlement.findMany({
      where: settlementWhere,
      include: {
        fromUser: true,
        toUser: true
      },
      orderBy: { settledAt: 'desc' }
    });

    let totalPaidByUser = 0;
    let totalPaidByFriend = 0;
    let userShare = 0;
    let friendShare = 0;
    let totalExpenses = 0;
    let expenseNetSum = 0;

    const relationshipExpenses: FriendRelationshipExpenseItem[] = [];

    for (const exp of expenses) {
      const userSplit = exp.splits.find((s) => s.userId === userId);
      const friendSplit = exp.splits.find((s) => s.userId === friendId);

      const uShare = userSplit?.amountOwed ?? 0;
      const fShare = friendSplit?.amountOwed ?? 0;

      let uPaid = 0;
      let fPaid = 0;
      let userNet = 0;
      let friendNet = 0;

      if (exp.paidBy === userId) {
        uPaid = exp.totalAmount;
        totalPaidByUser += exp.totalAmount;
        // Friend owes User friendShare
        userNet = fShare;
        friendNet = -fShare;
      } else if (exp.paidBy === friendId) {
        fPaid = exp.totalAmount;
        totalPaidByFriend += exp.totalAmount;
        // User owes Friend userShare
        userNet = -uShare;
        friendNet = uShare;
      }

      userShare += uShare;
      friendShare += fShare;
      totalExpenses += exp.totalAmount;
      expenseNetSum += userNet;

      relationshipExpenses.push({
        id: exp.id,
        description: exp.description,
        totalAmount: exp.totalAmount,
        paidBy: exp.paidBy,
        payerName: exp.payer.name,
        expenseDate: exp.expenseDate.toISOString(),
        groupId: exp.groupId,
        groupName: exp.group?.name,
        userShare: uShare,
        friendShare: fShare,
        userPaidAmount: uPaid,
        friendPaidAmount: fPaid,
        userNet,
        friendNet
      });
    }

    // Calculate settlement impact:
    // When User paid Friend, User reduced what they owe or increased what Friend owes -> +amount
    // When Friend paid User, Friend reduced what they owe User -> -amount
    let settlementImpact = 0;
    const settlementItems: SettlementItem[] = [];

    for (const s of settlements) {
      if (s.fromUserId === userId) {
        settlementImpact += s.amount;
      } else if (s.fromUserId === friendId) {
        settlementImpact -= s.amount;
      }

      settlementItems.push({
        id: s.id,
        fromUserId: s.fromUserId,
        fromUserName: s.fromUser.name,
        toUserId: s.toUserId,
        toUserName: s.toUser.name,
        amount: s.amount,
        settledAt: s.settledAt.toISOString(),
        note: s.note,
        createdAt: s.createdAt.toISOString()
      });
    }

    const netBalance = expenseNetSum + settlementImpact;

    return {
      netBalance,
      totalPaidByUser,
      totalPaidByFriend,
      userShare,
      friendShare,
      totalExpenses,
      expenses: relationshipExpenses,
      settlements: settlementItems
    };
  }

  /**
   * Retrieves all friends of a user with full bilateral financial balances
   * (including group expenses and settlements).
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

      const { netBalance, totalPaidByUser, userShare } = await this.calculateRelationshipFinancials(userId, friendId);

      friendItems.push({
        id: f.id,
        friendId,
        friend: AuthService.toSafeUser(friendUser),
        netBalance,
        totalPaid: totalPaidByUser,
        totalShare: userShare,
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
   * Retrieves complete friend relationship details including stats, balance, expenses, and settlements.
   */
  static async getFriendRelationshipDetails(
    userId: string,
    friendId: string,
    range?: string,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<FriendRelationshipDetails> {
    const { friendUser } = await this.getFriendshipOrThrow(userId, friendId);
    const dateRange = this.parseDateRange(range, startDateStr, endDateStr);

    const financials = await this.calculateRelationshipFinancials(userId, friendId, dateRange);

    return {
      friend: AuthService.toSafeUser(friendUser),
      ...financials
    };
  }

  /**
   * Records a non-destructive settlement between the authenticated user and their friend.
   */
  static async createSettlement(userId: string, input: CreateSettlementInput): Promise<SettlementItem> {
    const { friendUser } = await this.getFriendshipOrThrow(userId, input.friendId);

    // Compute current balance between user and friend
    const { netBalance } = await this.calculateRelationshipFinancials(userId, input.friendId);

    let fromUserId: string;
    let toUserId: string;
    let settlementAmount: number;

    if (input.amount !== undefined) {
      settlementAmount = input.amount;
      if (settlementAmount <= 0) {
        throw new ValidationError('Settlement amount must be positive.');
      }

      // Determine payment direction based on who owes whom
      if (netBalance > 0) {
        // Friend owes user -> Friend pays User
        fromUserId = input.friendId;
        toUserId = userId;
      } else if (netBalance < 0) {
        // User owes friend -> User pays Friend
        fromUserId = userId;
        toUserId = input.friendId;
      } else {
        // Settled up already, default to user paying friend for advance / reimbursement
        fromUserId = userId;
        toUserId = input.friendId;
      }
    } else {
      // Settle full balance
      if (netBalance === 0) {
        throw new ValidationError(`You and ${friendUser.name} are already settled up.`);
      }

      settlementAmount = Math.abs(netBalance);

      if (netBalance > 0) {
        // Friend owes user -> Friend pays User
        fromUserId = input.friendId;
        toUserId = userId;
      } else {
        // User owes friend -> User pays Friend
        fromUserId = userId;
        toUserId = input.friendId;
      }
    }

    const settlement = await prisma.settlement.create({
      data: {
        fromUserId,
        toUserId,
        amount: settlementAmount,
        note: input.note || null,
        settledAt: new Date()
      },
      include: {
        fromUser: true,
        toUser: true
      }
    });

    setImmediate(() => {
      TelegramService.notifySettlement(settlement.id).catch(() => {});
    });

    return {
      id: settlement.id,
      fromUserId: settlement.fromUserId,
      fromUserName: settlement.fromUser.name,
      toUserId: settlement.toUserId,
      toUserName: settlement.toUser.name,
      amount: settlement.amount,
      settledAt: settlement.settledAt.toISOString(),
      note: settlement.note,
      createdAt: settlement.createdAt.toISOString()
    };
  }

  /**
   * Generates a real Excel (.xlsx) workbook for the friend relationship.
   * Includes 3 sheets:
   * 1. Summary
   * 2. Expenses
   * 3. Settlements
   */
  static async generateFriendExcel(
    userId: string,
    friendId: string,
    range?: string,
    startDateStr?: string,
    endDateStr?: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { friendUser } = await this.getFriendshipOrThrow(userId, friendId);
    const dateRange = this.parseDateRange(range, startDateStr, endDateStr);
    const financials = await this.calculateRelationshipFinancials(userId, friendId, dateRange);

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    const currentUserName = currentUser?.name || 'You';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Splitwise';
    workbook.created = new Date();

    // -------------------------------------------------------------
    // SHEET 1: SUMMARY
    // -------------------------------------------------------------
    const summarySheet = workbook.addWorksheet('Summary', {
      views: [{ showGridLines: true }]
    });

    summarySheet.columns = [
      { width: 22 },
      { width: 34 }
    ];

    // Header Title
    summarySheet.mergeCells('A1:B1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'Friend Expense Summary';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Dark Slate
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 36;

    const summaryData: [string, string | number][] = [
      ['Friend:', `${friendUser.name} (${friendUser.email})`],
      ['Period:', dateRange.label],
      ['Total Expenses:', financials.totalExpenses / 100],
      ['You Paid:', financials.totalPaidByUser / 100],
      ['Friend Paid:', financials.totalPaidByFriend / 100],
      ['Your Share:', financials.userShare / 100],
      ['Friend Share:', financials.friendShare / 100],
    ];

    let rowIdx = 3;
    for (const [label, val] of summaryData) {
      const row = summarySheet.getRow(rowIdx);
      row.getCell(1).value = label;
      row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };

      const valueCell = row.getCell(2);
      if (typeof val === 'number') {
        valueCell.value = val;
        valueCell.numFmt = '₹#,##0.00';
      } else {
        valueCell.value = val;
      }
      rowIdx++;
    }

    // Balance highlight
    rowIdx++;
    const balanceRow = summarySheet.getRow(rowIdx);
    balanceRow.getCell(1).value = 'Current Balance:';
    balanceRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };

    const balanceValueCell = balanceRow.getCell(2);
    if (financials.netBalance > 0) {
      balanceValueCell.value = `${friendUser.name} owes you ₹${(financials.netBalance / 100).toFixed(2)}`;
      balanceValueCell.font = { bold: true, size: 12, color: { argb: 'FF059669' } }; // Emerald
    } else if (financials.netBalance < 0) {
      balanceValueCell.value = `You owe ${friendUser.name} ₹${(Math.abs(financials.netBalance) / 100).toFixed(2)}`;
      balanceValueCell.font = { bold: true, size: 12, color: { argb: 'FFE11D48' } }; // Rose
    } else {
      balanceValueCell.value = `You and ${friendUser.name} are settled up (₹0.00)`;
      balanceValueCell.font = { bold: true, size: 12, color: { argb: 'FF475569' } }; // Slate
    }

    // -------------------------------------------------------------
    // SHEET 2: EXPENSES
    // -------------------------------------------------------------
    const expensesSheet = workbook.addWorksheet('Expenses', {
      views: [{ showGridLines: true }]
    });

    expensesSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Description', key: 'desc', width: 28 },
      { header: 'Total Amount', key: 'total', width: 16 },
      { header: 'Paid By', key: 'payer', width: 16 },
      { header: 'Your Share', key: 'uShare', width: 14 },
      { header: 'Friend Share', key: 'fShare', width: 14 },
      { header: 'Your Paid Amount', key: 'uPaid', width: 18 },
      { header: 'Friend Paid Amount', key: 'fPaid', width: 18 },
      { header: 'Your Net', key: 'uNet', width: 14 },
      { header: 'Friend Net', key: 'fNet', width: 14 },
      { header: 'Group', key: 'group', width: 18 }
    ];

    // Style Header Row
    const expHeader = expensesSheet.getRow(1);
    expHeader.height = 26;
    expHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const exp of financials.expenses) {
      const expDate = new Date(exp.expenseDate).toLocaleDateString('en-GB'); // DD/MM/YYYY
      const paidByLabel = exp.paidBy === userId ? 'You' : friendUser.name;
      const groupLabel = exp.groupName || 'Direct';

      const row = expensesSheet.addRow({
        date: expDate,
        desc: exp.description,
        total: exp.totalAmount / 100,
        payer: paidByLabel,
        uShare: exp.userShare / 100,
        fShare: exp.friendShare / 100,
        uPaid: exp.userPaidAmount / 100,
        fPaid: exp.friendPaidAmount / 100,
        uNet: (exp.userNet >= 0 ? '+' : '') + (exp.userNet / 100).toFixed(2),
        fNet: (exp.friendNet >= 0 ? '+' : '') + (exp.friendNet / 100).toFixed(2),
        group: groupLabel
      });

      row.getCell('total').numFmt = '₹#,##0.00';
      row.getCell('uShare').numFmt = '₹#,##0.00';
      row.getCell('fShare').numFmt = '₹#,##0.00';
      row.getCell('uPaid').numFmt = '₹#,##0.00';
      row.getCell('fPaid').numFmt = '₹#,##0.00';
    }

    // -------------------------------------------------------------
    // SHEET 3: SETTLEMENTS
    // -------------------------------------------------------------
    const settlementsSheet = workbook.addWorksheet('Settlements', {
      views: [{ showGridLines: true }]
    });

    settlementsSheet.columns = [
      { header: 'Date', key: 'date', width: 16 },
      { header: 'From', key: 'from', width: 20 },
      { header: 'To', key: 'to', width: 20 },
      { header: 'Amount', key: 'amount', width: 16 },
      { header: 'Note', key: 'note', width: 30 }
    ];

    const setHeader = settlementsSheet.getRow(1);
    setHeader.height = 26;
    setHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (const s of financials.settlements) {
      const sDate = new Date(s.settledAt).toLocaleDateString('en-GB');
      const fromLabel = s.fromUserId === userId ? 'You' : friendUser.name;
      const toLabel = s.toUserId === userId ? 'You' : friendUser.name;

      const row = settlementsSheet.addRow({
        date: sDate,
        from: fromLabel,
        to: toLabel,
        amount: s.amount / 100,
        note: s.note || '-'
      });

      row.getCell('amount').numFmt = '₹#,##0.00';
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);

    const sanitizedFriend = friendUser.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'friend';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `friend-${sanitizedFriend}-expenses-${dateStr}.xlsx`;

    return { buffer, filename };
  }

  /**
   * Legacy method for direct expenses between friends. Kept for backward compatibility.
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
      tripId: e.tripId,
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
