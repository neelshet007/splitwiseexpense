import { describe, it, expect } from 'vitest';
import { ExpensesService } from '../src/modules/expenses/expenses.service';

describe('Direct Friend Expenses (1-to-1 Split)', () => {
  it('correctly calculates 50/50 equal split between two friends', () => {
    // ₹1,200 dinner between Neel & Rahul -> ₹600 each
    const splits = [
      { userId: 'u_neel' },
      { userId: 'u_rahul' }
    ];

    const result = ExpensesService.calculateSplits(120000, 'EQUAL', splits);

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { userId: 'u_neel', amountOwed: 60000 },
      { userId: 'u_rahul', amountOwed: 60000 }
    ]);
  });

  it('correctly handles uneven minor unit cents between two friends', () => {
    // ₹15.01 = 1501 paise -> 751 paise and 750 paise
    const splits = [
      { userId: 'u_neel' },
      { userId: 'u_rahul' }
    ];

    const result = ExpensesService.calculateSplits(1501, 'EQUAL', splits);

    expect(result).toEqual([
      { userId: 'u_neel', amountOwed: 751 },
      { userId: 'u_rahul', amountOwed: 750 }
    ]);
    expect(result.reduce((a, b) => a + b.amountOwed, 0)).toBe(1501);
  });

  it('allows exact custom split between friends', () => {
    // Total ₹500: Neel ₹300, Rahul ₹200
    const splits = [
      { userId: 'u_neel', amountOwed: 30000 },
      { userId: 'u_rahul', amountOwed: 20000 }
    ];

    const result = ExpensesService.calculateSplits(50000, 'EXACT', splits);
    expect(result).toEqual(splits);
  });
});
