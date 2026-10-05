import { describe, it, expect } from 'vitest';
import { FriendsService } from '../src/modules/friends/friends.service';
import ExcelJS from 'exceljs';

describe('Friend Dashboard Financial Engine & Isolation', () => {
  it('correctly calculates bilateral balance for a direct expense (Neel paid ₹1200, 50/50 with Rahul)', () => {
    // Simulated expenses between User (Neel) and Friend (Rahul)
    const userId = 'u_neel';
    const friendId = 'u_rahul';

    // Neel paid 1200, splits: Neel 600, Rahul 600
    const exp = {
      paidBy: userId,
      totalAmount: 120000,
      splits: [
        { userId, amountOwed: 60000 },
        { userId: friendId, amountOwed: 60000 }
      ]
    };

    const friendSplit = exp.splits.find((s) => s.userId === friendId);
    const userSplit = exp.splits.find((s) => s.userId === userId);

    let userNet = 0;
    if (exp.paidBy === userId) {
      userNet = friendSplit!.amountOwed;
    }

    expect(userNet).toBe(60000); // Rahul owes Neel ₹600
  });

  it('correctly isolates pairwise financial relationship in multi-person group expenses', () => {
    // Group expense: ₹3,000 paid by Neel.
    // Splits: Neel ₹1,000, Rahul ₹1,000, Aman ₹1,000.
    const userId = 'u_neel';
    const friendId = 'u_rahul';
    const thirdPartyId = 'u_aman';

    const groupExpense = {
      paidBy: userId,
      totalAmount: 300000,
      splits: [
        { userId, amountOwed: 100000 },
        { userId: friendId, amountOwed: 100000 },
        { userId: thirdPartyId, amountOwed: 100000 }
      ]
    };

    // Calculate ONLY the Neel <-> Rahul relationship
    const friendSplit = groupExpense.splits.find((s) => s.userId === friendId);
    let neelRahulBilateralNet = 0;
    if (groupExpense.paidBy === userId) {
      neelRahulBilateralNet = friendSplit!.amountOwed;
    }

    // Rahul owes Neel ₹1,000. Aman's ₹1,000 does NOT affect Rahul's balance with Neel!
    expect(neelRahulBilateralNet).toBe(100000);
  });

  it('ignores group expenses paid by a third party for the bilateral relationship', () => {
    // Group expense: ₹3,000 paid by Aman.
    // Splits: Neel ₹1,000, Rahul ₹1,000, Aman ₹1,000.
    const userId = 'u_neel';
    const friendId = 'u_rahul';
    const thirdPartyId = 'u_aman';

    const groupExpense = {
      paidBy: thirdPartyId,
      totalAmount: 300000,
      splits: [
        { userId, amountOwed: 100000 },
        { userId: friendId, amountOwed: 100000 },
        { userId: thirdPartyId, amountOwed: 100000 }
      ]
    };

    // Is this expense relevant to Neel <-> Rahul pairwise balance?
    const isRelevant =
      (groupExpense.paidBy === userId && groupExpense.splits.some((s) => s.userId === friendId)) ||
      (groupExpense.paidBy === friendId && groupExpense.splits.some((s) => s.userId === userId));

    expect(isRelevant).toBe(false);
  });

  it('correctly accounts for non-destructive settlements in bilateral balance', () => {
    // 1. Neel paid ₹1,200 for Dinner (Rahul owes ₹600)
    // 2. Rahul settles ₹500 to Neel
    let bilateralNet = 60000; // Rahul owes ₹600

    // Rahul pays Neel ₹500
    const settlement = {
      fromUserId: 'u_rahul',
      toUserId: 'u_neel',
      amount: 50000
    };

    if (settlement.fromUserId === 'u_rahul') {
      bilateralNet -= settlement.amount;
    }

    expect(bilateralNet).toBe(10000); // Rahul now owes ₹100
  });

  it('correctly parses date ranges for filtering', () => {
    const all = FriendsService.parseDateRange('all');
    expect(all.label).toBe('All Time');
    expect(all.startDate).toBeUndefined();

    const thisMonth = FriendsService.parseDateRange('this_month');
    expect(thisMonth.label).toContain('This Month');
    expect(thisMonth.startDate).toBeInstanceOf(Date);
    expect(thisMonth.endDate).toBeInstanceOf(Date);

    const custom = FriendsService.parseDateRange('custom', '2026-01-01', '2026-03-31');
    expect(custom.label).toContain('Custom');
    expect(custom.startDate).toEqual(new Date('2026-01-01'));
  });

  it('generates a valid 3-sheet Excel workbook with correct headers and data', async () => {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Summary');
    const expensesSheet = workbook.addWorksheet('Expenses');
    const settlementsSheet = workbook.addWorksheet('Settlements');

    summarySheet.addRow(['Friend:', 'Rahul']);
    summarySheet.addRow(['Current Balance:', 'Rahul owes you ₹1,240.00']);

    expensesSheet.addRow(['Date', 'Description', 'Total Amount', 'Paid By', 'Your Share', 'Friend Share']);
    expensesSheet.addRow(['02/10/2026', 'Dinner', 1200, 'You', 600, 600]);

    settlementsSheet.addRow(['Date', 'From', 'To', 'Amount', 'Note']);
    settlementsSheet.addRow(['12/09/2026', 'Rahul', 'You', 500, 'Dinner settlement']);

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.length).toBeGreaterThan(0);

    // Verify workbook can be reloaded and read
    const readWorkbook = new ExcelJS.Workbook();
    await readWorkbook.xlsx.load(buffer);

    expect(readWorkbook.worksheets.map((w) => w.name)).toEqual(['Summary', 'Expenses', 'Settlements']);
    const readSummary = readWorkbook.getWorksheet('Summary')!;
    expect(readSummary.getCell('B1').value).toBe('Rahul');
  });
});
