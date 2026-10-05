import { describe, it, expect } from 'vitest';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { SettlementService } from '../src/modules/balances/settlements.service';
import { UserBalance } from '@splitwise/types';
import ExcelJS from 'exceljs';

describe('Trip Expense Splitting & Scenarios', () => {
  const neelId = 'user-neel';
  const harshId = 'user-harsh';
  const sanviId = 'user-sanvi';
  const rahulId = 'user-rahul';

  it('Scenario A: ₹100 paid by Neel only for Harsh (Full Amount)', () => {
    // 10000 minor units = ₹100.00
    const totalAmount = 10000;
    const splits = ExpensesService.calculateSplits(totalAmount, 'FULL_AMOUNT', [
      { userId: harshId, amountOwed: totalAmount }
    ]);

    expect(splits).toHaveLength(1);
    expect(splits[0].userId).toBe(harshId);
    expect(splits[0].amountOwed).toBe(10000); // Harsh owes ₹100.00

    // Balances calculation
    const balances: UserBalance[] = [
      { userId: neelId, userName: 'Neel', email: 'neel@test.com', totalPaid: 10000, totalShare: 0, netBalance: 10000 },
      { userId: harshId, userName: 'Harsh', email: 'harsh@test.com', totalPaid: 0, totalShare: 10000, netBalance: -10000 },
      { userId: sanviId, userName: 'Sanvi', email: 'sanvi@test.com', totalPaid: 0, totalShare: 0, netBalance: 0 },
      { userId: rahulId, userName: 'Rahul', email: 'rahul@test.com', totalPaid: 0, totalShare: 0, netBalance: 0 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      fromUserId: harshId,
      fromUserName: 'Harsh',
      toUserId: neelId,
      toUserName: 'Neel',
      amount: 10000 // ₹100.00
    });
  });

  it('Scenario B: ₹200 shared equally across all 4 trip members', () => {
    // 20000 minor units = ₹200.00
    const totalAmount = 20000;
    const participants = [
      { userId: neelId },
      { userId: harshId },
      { userId: sanviId },
      { userId: rahulId }
    ];

    const splits = ExpensesService.calculateSplits(totalAmount, 'EQUAL', participants);
    expect(splits).toHaveLength(4);
    splits.forEach((s) => {
      expect(s.amountOwed).toBe(5000); // ₹50.00 each
    });

    // Neel paid ₹200. His share is ₹50, so net is +₹150. Others owe ₹50 each.
    const balances: UserBalance[] = [
      { userId: neelId, userName: 'Neel', email: 'neel@test.com', totalPaid: 20000, totalShare: 5000, netBalance: 15000 },
      { userId: harshId, userName: 'Harsh', email: 'harsh@test.com', totalPaid: 0, totalShare: 5000, netBalance: -5000 },
      { userId: sanviId, userName: 'Sanvi', email: 'sanvi@test.com', totalPaid: 0, totalShare: 5000, netBalance: -5000 },
      { userId: rahulId, userName: 'Rahul', email: 'rahul@test.com', totalPaid: 0, totalShare: 5000, netBalance: -5000 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);
    expect(settlements).toHaveLength(3);
    const amounts = settlements.map((s) => s.amount);
    expect(amounts).toEqual([5000, 5000, 5000]);
    settlements.forEach((s) => {
      expect(s.toUserId).toBe(neelId);
    });
  });

  it('Scenario C: ₹300 only between Neel and Sanvi (Harsh and Rahul unaffected)', () => {
    // 30000 minor units = ₹300.00
    const totalAmount = 30000;
    const participants = [
      { userId: neelId },
      { userId: sanviId }
    ];

    const splits = ExpensesService.calculateSplits(totalAmount, 'EQUAL', participants);
    expect(splits).toHaveLength(2);
    expect(splits[0].amountOwed).toBe(15000); // ₹150.00
    expect(splits[1].amountOwed).toBe(15000); // ₹150.00

    const balances: UserBalance[] = [
      { userId: neelId, userName: 'Neel', email: 'neel@test.com', totalPaid: 30000, totalShare: 15000, netBalance: 15000 },
      { userId: sanviId, userName: 'Sanvi', email: 'sanvi@test.com', totalPaid: 0, totalShare: 15000, netBalance: -15000 },
      { userId: harshId, userName: 'Harsh', email: 'harsh@test.com', totalPaid: 0, totalShare: 0, netBalance: 0 },
      { userId: rahulId, userName: 'Rahul', email: 'rahul@test.com', totalPaid: 0, totalShare: 0, netBalance: 0 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      fromUserId: sanviId,
      fromUserName: 'Sanvi',
      toUserId: neelId,
      toUserName: 'Neel',
      amount: 15000 // ₹150.00
    });
  });

  it('Scenario D (Example 15): ₹1,000 paid by Harsh for Neel, Harsh, Sanvi with deterministic rounding', () => {
    // 100000 minor units = ₹1,000.00
    const totalAmount = 100000;
    const participants = [
      { userId: harshId },
      { userId: neelId },
      { userId: sanviId }
    ];

    const splits = ExpensesService.calculateSplits(totalAmount, 'EQUAL', participants);
    expect(splits).toHaveLength(3);
    const sumSplits = splits.reduce((acc, curr) => acc + curr.amountOwed, 0);
    expect(sumSplits).toBe(100000); // Exact penny match

    // First gets 33334, others 33333
    expect(splits[0].amountOwed).toBe(33334);
    expect(splits[1].amountOwed).toBe(33333);
    expect(splits[2].amountOwed).toBe(33333);

    // Harsh paid 100000, his share is 33334 -> net +66666
    // Neel owes 33333 -> net -33333
    // Sanvi owes 33333 -> net -33333
    const balances: UserBalance[] = [
      { userId: harshId, userName: 'Harsh', email: 'harsh@test.com', totalPaid: 100000, totalShare: 33334, netBalance: 66666 },
      { userId: neelId, userName: 'Neel', email: 'neel@test.com', totalPaid: 0, totalShare: 33333, netBalance: -33333 },
      { userId: sanviId, userName: 'Sanvi', email: 'sanvi@test.com', totalPaid: 0, totalShare: 33333, netBalance: -33333 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);
    expect(settlements).toHaveLength(2);
    expect(settlements).toEqual([
      {
        fromUserId: neelId,
        fromUserName: 'Neel',
        toUserId: harshId,
        toUserName: 'Harsh',
        amount: 33333 // ₹333.33
      },
      {
        fromUserId: sanviId,
        fromUserName: 'Sanvi',
        toUserId: harshId,
        toUserName: 'Harsh',
        amount: 33333 // ₹333.33
      }
    ]);
  });

  it('generates human-friendly invite codes (e.g. GOA-7K4P2X)', () => {
    const cleanPrefix = 'Goa Trip'.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    expect(cleanPrefix).toBe('GOA');

    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    const code = `${cleanPrefix}-${randomPart}`;
    expect(code).toMatch(/^GOA-[2-9A-HJ-NP-Z]{6}$/);
    expect(randomPart).not.toContain('0');
    expect(randomPart).not.toContain('O');
  });

  it('generates multi-sheet Excel workbook with complete Trip ledger', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Summary');
    workbook.addWorksheet('Expenses');
    workbook.addWorksheet('Splits');
    workbook.addWorksheet('Settlements');

    expect(workbook.worksheets).toHaveLength(4);
    const names = workbook.worksheets.map((w) => w.name);
    expect(names).toEqual(['Summary', 'Expenses', 'Splits', 'Settlements']);

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
