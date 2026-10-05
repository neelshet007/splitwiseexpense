import { prisma } from '@splitwise/database';
import { AuthService } from '../auth/auth.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import {
  CreateTripInput,
  UpdateTripInput,
  AddTripMemberInput,
  JoinTripInput,
  RecordTripSettlementInput
} from '@splitwise/validation';
import {
  TripItem,
  TripPreviewResponse,
  JoinTripResponse,
  TripBalancesResponse,
  TripSettlementsResponse,
  UserBalance
} from '@splitwise/types';
import { SettlementService } from '../balances/settlements.service';
import { TelegramService } from '../telegram/telegram.service';
import ExcelJS from 'exceljs';

export class TripsService {
  /**
   * Generates a clean, human-friendly invite code (e.g. GOA-7K4P2X, TRIP-9M2N8R).
   * Do NOT expose database UUIDs.
   */
  private static generateInviteCode(tripName: string): string {
    const cleanPrefix =
      tripName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3) || 'TRP';

    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return `${cleanPrefix}-${randomPart}`;
  }

  private static formatTrip(trip: any): TripItem {
    return {
      id: trip.id,
      name: trip.name,
      description: trip.description || null,
      inviteCode: trip.inviteCode,
      isArchived: trip.isArchived ?? false,
      createdBy: trip.createdBy,
      createdAt: trip.createdAt instanceof Date ? trip.createdAt.toISOString() : trip.createdAt,
      updatedAt: trip.updatedAt instanceof Date ? trip.updatedAt.toISOString() : trip.updatedAt,
      members: (trip.members || []).map((m: any) => ({
        id: m.id,
        tripId: m.tripId,
        userId: m.userId,
        role: m.role || 'MEMBER',
        joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : m.joinedAt,
        user: AuthService.toSafeUser(m.user)
      })),
      _count: trip._count
    };
  }

  static async createTrip(userId: string, data: CreateTripInput): Promise<TripItem> {
    let inviteCode = this.generateInviteCode(data.name);
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.trip.findUnique({ where: { inviteCode } });
      if (!exists) break;
      inviteCode = this.generateInviteCode(data.name);
      attempts++;
    }

    const trip = await prisma.trip.create({
      data: {
        name: data.name.trim(),
        description: data.description ? data.description.trim() : null,
        inviteCode,
        createdBy: userId,
        members: {
          create: [{ userId, role: 'ADMIN' }]
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

    return this.formatTrip(trip);
  }

  static async listUserTrips(userId: string): Promise<TripItem[]> {
    const memberships = await prisma.tripMember.findMany({
      where: { userId },
      include: {
        trip: {
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

    return memberships.map((m) => this.formatTrip(m.trip));
  }

  static async getTripById(tripId: string): Promise<TripItem> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' }
        },
        _count: {
          select: { expenses: true, members: true }
        }
      }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    return this.formatTrip(trip);
  }

  static async updateTrip(tripId: string, currentUserId: string, data: UpdateTripInput): Promise<TripItem> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: { where: { userId: currentUserId } } }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const membership = trip.members[0];
    if (!membership || (membership.role !== 'ADMIN' && trip.createdBy !== currentUserId)) {
      throw new ForbiddenError('Only the trip admin can edit trip details.');
    }

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: {
        name: data.name ? data.name.trim() : undefined,
        description: data.description !== undefined ? data.description : undefined,
        isArchived: data.isArchived !== undefined ? data.isArchived : undefined
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

    return this.formatTrip(updated);
  }

  static async deleteTrip(tripId: string, currentUserId: string): Promise<void> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: { where: { userId: currentUserId } } }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const membership = trip.members[0];
    if (!membership || (membership.role !== 'ADMIN' && trip.createdBy !== currentUserId)) {
      throw new ForbiddenError('Only the trip admin can delete this trip.');
    }

    await prisma.trip.delete({
      where: { id: tripId }
    });
  }

  static async regenerateInviteCode(tripId: string, currentUserId: string): Promise<{ inviteCode: string }> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: { where: { userId: currentUserId } } }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const membership = trip.members[0];
    if (!membership || (membership.role !== 'ADMIN' && trip.createdBy !== currentUserId)) {
      throw new ForbiddenError('Only the trip admin can regenerate the invite code.');
    }

    let inviteCode = this.generateInviteCode(trip.name);
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.trip.findUnique({ where: { inviteCode } });
      if (!exists) break;
      inviteCode = this.generateInviteCode(trip.name);
      attempts++;
    }

    await prisma.trip.update({
      where: { id: tripId },
      data: { inviteCode }
    });

    return { inviteCode };
  }

  static async getTripPreview(inviteCode: string, currentUserId?: string): Promise<TripPreviewResponse> {
    const trip = await prisma.trip.findUnique({
      where: { inviteCode: inviteCode.toUpperCase().trim() },
      include: {
        creator: true,
        members: currentUserId ? { where: { userId: currentUserId } } : false,
        _count: {
          select: { members: true }
        }
      }
    });

    if (!trip) {
      throw new NotFoundError('Invalid or expired trip invite code');
    }

    return {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      inviteCode: trip.inviteCode,
      memberCount: trip._count.members,
      creatorName: trip.creator.name,
      isMember: Array.isArray(trip.members) && trip.members.length > 0
    };
  }

  static async joinTripByInviteCode(userId: string, data: JoinTripInput): Promise<JoinTripResponse> {
    const trip = await prisma.trip.findUnique({
      where: { inviteCode: data.inviteCode.toUpperCase().trim() },
      include: {
        members: {
          include: { user: true }
        },
        _count: {
          select: { expenses: true, members: true }
        }
      }
    });

    if (!trip) {
      throw new NotFoundError('Invalid trip invite code');
    }

    const alreadyMember = trip.members.some((m) => m.userId === userId);

    if (alreadyMember) {
      return {
        trip: this.formatTrip(trip),
        alreadyMember: true,
        message: 'You are already a member of this trip'
      };
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        members: {
          create: [{ userId, role: 'MEMBER' }]
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

    return {
      trip: this.formatTrip(updatedTrip),
      alreadyMember: false,
      message: 'Successfully joined trip'
    };
  }

  static async addMember(tripId: string, data: AddTripMemberInput): Promise<TripItem> {
    const userToAdd = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() }
    });

    if (!userToAdd) {
      throw new NotFoundError(`No user found with email ${data.email}`);
    }

    const existingMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: userToAdd.id
        }
      }
    });

    if (existingMember) {
      throw new ConflictError('User is already a member of this trip');
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        members: {
          create: [{ userId: userToAdd.id, role: 'MEMBER' }]
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

    return this.formatTrip(updatedTrip);
  }

  static async removeMember(tripId: string, memberUserId: string, currentUserId: string): Promise<void> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const currentMember = trip.members.find((m) => m.userId === currentUserId);
    const isAdmin = currentMember?.role === 'ADMIN' || trip.createdBy === currentUserId;
    const isSelf = currentUserId === memberUserId;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenError('You do not have permission to remove this member');
    }

    // Verify member does not have active non-zero balance in this trip
    const balances = await this.calculateTripBalances(tripId, currentUserId);
    const memberBalance = balances.balances.find((b) => b.userId === memberUserId);

    if (memberBalance && Math.abs(memberBalance.netBalance) > 0) {
      throw new ValidationError(
        `Cannot remove member with outstanding balance (${memberBalance.netBalance > 0 ? 'owed' : 'owes'} ₹${(
          Math.abs(memberBalance.netBalance) / 100
        ).toFixed(2)}). Please settle first.`
      );
    }

    await prisma.tripMember.delete({
      where: {
        tripId_userId: {
          tripId,
          userId: memberUserId
        }
      }
    });
  }

  /**
   * Calculates complete Trip balances:
   * Each expense independently affects only its selected participants and payer.
   * Settlements inside this trip update balances accordingly.
   */
  static async calculateTripBalances(tripId: string, currentUserId: string): Promise<TripBalancesResponse> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: {
          include: { user: true }
        }
      }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const expenses = await prisma.expense.findMany({
      where: { tripId },
      include: { splits: true }
    });

    const settlements = await prisma.tripSettlement.findMany({
      where: { tripId }
    });

    let totalTripExpenses = 0;

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

    for (const m of trip.members) {
      balanceMap.set(m.userId, {
        userId: m.userId,
        userName: m.user.name,
        email: m.user.email,
        totalPaid: 0,
        totalShare: 0
      });
    }

    // 1. Process Expenses
    for (const exp of expenses) {
      totalTripExpenses += exp.totalAmount;

      const payerEntry = balanceMap.get(exp.paidBy);
      if (payerEntry) {
        payerEntry.totalPaid += exp.totalAmount;
      }

      for (const split of exp.splits) {
        const participantEntry = balanceMap.get(split.userId);
        if (participantEntry) {
          participantEntry.totalShare += split.amountOwed;
        }
      }
    }

    // 2. Process Settlements within this Trip
    for (const st of settlements) {
      const payerEntry = balanceMap.get(st.fromUserId);
      if (payerEntry) {
        payerEntry.totalPaid += st.amount;
      }

      const receiverEntry = balanceMap.get(st.toUserId);
      if (receiverEntry) {
        receiverEntry.totalShare += st.amount;
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

    const myEntry = balanceMap.get(currentUserId);
    const youPaid = myEntry ? myEntry.totalPaid : 0;
    const yourShare = myEntry ? myEntry.totalShare : 0;
    const netBalance = youPaid - yourShare;

    return {
      tripId,
      totalExpenses: totalTripExpenses,
      youPaid,
      yourShare,
      youAreOwed: Math.max(0, netBalance),
      youOwe: Math.max(0, -netBalance),
      netBalance,
      balances
    };
  }

  static async getTripSettlements(tripId: string, currentUserId: string): Promise<TripSettlementsResponse> {
    const { balances } = await this.calculateTripBalances(tripId, currentUserId);
    const simplifiedSettlements = SettlementService.simplifyDebts(balances);

    const recordedSettlements = await prisma.tripSettlement.findMany({
      where: { tripId },
      include: {
        fromUser: true,
        toUser: true
      },
      orderBy: { settledAt: 'desc' }
    });

    return {
      tripId,
      settlements: simplifiedSettlements,
      recordedSettlements: recordedSettlements.map((s) => ({
        id: s.id,
        tripId: s.tripId,
        fromUserId: s.fromUserId,
        fromUser: AuthService.toSafeUser(s.fromUser),
        toUserId: s.toUserId,
        toUser: AuthService.toSafeUser(s.toUser),
        amount: s.amount,
        settledAt: s.settledAt instanceof Date ? s.settledAt.toISOString() : s.settledAt,
        note: s.note,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt
      }))
    };
  }

  static async recordTripSettlement(
    tripId: string,
    currentUserId: string,
    data: RecordTripSettlementInput
  ): Promise<any> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const memberIds = new Set(trip.members.map((m) => m.userId));
    if (!memberIds.has(data.fromUserId) || !memberIds.has(data.toUserId)) {
      throw new ValidationError('Both settlement participants must be members of the trip.');
    }

    if (data.fromUserId === data.toUserId) {
      throw new ValidationError('Cannot settle debt with yourself.');
    }

    const settlement = await prisma.tripSettlement.create({
      data: {
        tripId,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        amount: data.amount,
        note: data.note ? data.note.trim() : null
      },
      include: {
        fromUser: true,
        toUser: true
      }
    });

    // Notify participants via Telegram
    setImmediate(async () => {
      try {
        const formattedAmount = `₹${(data.amount / 100).toFixed(2)}`;
        const noteText = data.note ? `\n📝 <i>"${data.note}"</i>` : '';

        if (settlement.fromUser.telegramConnected && settlement.fromUser.telegramChatId) {
          await TelegramService.sendMessage(
            settlement.fromUser.telegramChatId,
            `🌴 <b>Trip Settlement Recorded: ${trip.name}</b>\n\n` +
              `You paid <b>${settlement.toUser.name}</b> ${formattedAmount}.${noteText}`
          );
        }

        if (settlement.toUser.telegramConnected && settlement.toUser.telegramChatId) {
          await TelegramService.sendMessage(
            settlement.toUser.telegramChatId,
            `🌴 <b>Trip Settlement Received: ${trip.name}</b>\n\n` +
              `<b>${settlement.fromUser.name}</b> paid you ${formattedAmount}.${noteText}`
          );
        }
      } catch (e) {
        // Safe post-commit hook
      }
    });

    return {
      id: settlement.id,
      tripId: settlement.tripId,
      fromUserId: settlement.fromUserId,
      fromUser: AuthService.toSafeUser(settlement.fromUser),
      toUserId: settlement.toUserId,
      toUser: AuthService.toSafeUser(settlement.toUser),
      amount: settlement.amount,
      settledAt: settlement.settledAt.toISOString(),
      note: settlement.note
    };
  }

  /**
   * Export complete Trip ledger to Excel (.xlsx):
   * Sheet 1: Summary
   * Sheet 2: Expenses
   * Sheet 3: Splits
   * Sheet 4: Settlements
   */
  static async exportTripToExcel(tripId: string): Promise<ExcelJS.Buffer> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        creator: true,
        members: {
          include: { user: true }
        }
      }
    });

    if (!trip) {
      throw new NotFoundError('Trip not found');
    }

    const expenses = await prisma.expense.findMany({
      where: { tripId },
      include: {
        payer: true,
        creator: true,
        splits: {
          include: { user: true }
        }
      },
      orderBy: { expenseDate: 'asc' }
    });

    const settlements = await prisma.tripSettlement.findMany({
      where: { tripId },
      include: {
        fromUser: true,
        toUser: true
      },
      orderBy: { settledAt: 'asc' }
    });

    const balances = await this.calculateTripBalances(tripId, trip.createdBy);
    const simplifiedSettlements = SettlementService.simplifyDebts(balances.balances);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Splitwise Trips';
    workbook.created = new Date();

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Slate 900
    };

    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };

    // ---------------------------------------------------------
    // SHEET 1: SUMMARY
    // ---------------------------------------------------------
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Property', key: 'property', width: 22 },
      { header: 'Value', key: 'value', width: 32 }
    ];

    summarySheet.getRow(1).fill = headerFill;
    summarySheet.getRow(1).font = headerFont;

    summarySheet.addRow({ property: 'Trip Name', value: trip.name });
    summarySheet.addRow({ property: 'Trip Code', value: trip.inviteCode });
    summarySheet.addRow({ property: 'Description', value: trip.description || 'N/A' });
    summarySheet.addRow({ property: 'Created By', value: trip.creator.name });
    summarySheet.addRow({ property: 'Created At', value: trip.createdAt.toLocaleDateString('en-IN') });
    summarySheet.addRow({
      property: 'Total Expenses',
      value: `₹${(balances.totalExpenses / 100).toFixed(2)}`
    });
    summarySheet.addRow({ property: 'Total Members', value: trip.members.length });

    summarySheet.addRow({});
    const memHeaderRow = summarySheet.addRow(['Member Balances', '', '', '', '']);
    memHeaderRow.font = { bold: true, size: 12 };

    const memColRow = summarySheet.addRow(['Name', 'Email', 'Total Paid (₹)', 'Total Share (₹)', 'Net Balance (₹)']);
    memColRow.fill = headerFill;
    memColRow.font = headerFont;

    for (const b of balances.balances) {
      summarySheet.addRow([
        b.userName,
        b.email,
        (b.totalPaid / 100).toFixed(2),
        (b.totalShare / 100).toFixed(2),
        (b.netBalance / 100).toFixed(2)
      ]);
    }

    summarySheet.addRow({});
    const simplifyHeaderRow = summarySheet.addRow(['Recommended Simplified Settlements', '', '']);
    simplifyHeaderRow.font = { bold: true, size: 12 };

    const simplifyColRow = summarySheet.addRow(['From (Debtor)', 'To (Creditor)', 'Amount (₹)']);
    simplifyColRow.fill = headerFill;
    simplifyColRow.font = headerFont;

    if (simplifiedSettlements.length === 0) {
      summarySheet.addRow(['All balances settled', '-', '0.00']);
    } else {
      for (const s of simplifiedSettlements) {
        summarySheet.addRow([s.fromUserName, s.toUserName, (s.amount / 100).toFixed(2)]);
      }
    }

    // ---------------------------------------------------------
    // SHEET 2: EXPENSES
    // ---------------------------------------------------------
    const expenseSheet = workbook.addWorksheet('Expenses');
    expenseSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Description', key: 'desc', width: 28 },
      { header: 'Amount (₹)', key: 'amount', width: 14 },
      { header: 'Paid By', key: 'paidBy', width: 18 },
      { header: 'Created By', key: 'createdBy', width: 18 },
      { header: 'Split Mode', key: 'splitType', width: 14 },
      { header: 'Participants', key: 'participants', width: 35 }
    ];
    expenseSheet.getRow(1).fill = headerFill;
    expenseSheet.getRow(1).font = headerFont;

    for (const exp of expenses) {
      const participantNames = exp.splits.map((s) => s.user.name).join(', ');
      expenseSheet.addRow({
        date: new Date(exp.expenseDate).toLocaleDateString('en-IN'),
        desc: exp.description,
        amount: (exp.totalAmount / 100).toFixed(2),
        paidBy: exp.payer.name,
        createdBy: exp.creator.name,
        splitType: exp.splitType,
        participants: participantNames
      });
    }

    // ---------------------------------------------------------
    // SHEET 3: SPLITS
    // ---------------------------------------------------------
    const splitSheet = workbook.addWorksheet('Splits');
    splitSheet.columns = [
      { header: 'Expense', key: 'expense', width: 26 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Member', key: 'member', width: 20 },
      { header: 'Amount Owed (₹)', key: 'amount', width: 16 },
      { header: 'Share %', key: 'pct', width: 12 }
    ];
    splitSheet.getRow(1).fill = headerFill;
    splitSheet.getRow(1).font = headerFont;

    for (const exp of expenses) {
      for (const s of exp.splits) {
        const pct = exp.totalAmount > 0 ? ((s.amountOwed / exp.totalAmount) * 100).toFixed(1) + '%' : '0%';
        splitSheet.addRow({
          expense: exp.description,
          date: new Date(exp.expenseDate).toLocaleDateString('en-IN'),
          member: s.user.name,
          amount: (s.amountOwed / 100).toFixed(2),
          pct
        });
      }
    }

    // ---------------------------------------------------------
    // SHEET 4: SETTLEMENTS
    // ---------------------------------------------------------
    const settlementSheet = workbook.addWorksheet('Settlements');
    settlementSheet.columns = [
      { header: 'From', key: 'from', width: 20 },
      { header: 'To', key: 'to', width: 20 },
      { header: 'Amount (₹)', key: 'amount', width: 14 },
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Note', key: 'note', width: 30 }
    ];
    settlementSheet.getRow(1).fill = headerFill;
    settlementSheet.getRow(1).font = headerFont;

    for (const st of settlements) {
      settlementSheet.addRow({
        from: st.fromUser.name,
        to: st.toUser.name,
        amount: (st.amount / 100).toFixed(2),
        date: new Date(st.settledAt).toLocaleDateString('en-IN'),
        note: st.note || ''
      });
    }

    return await workbook.xlsx.writeBuffer();
  }
}
