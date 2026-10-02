import { describe, it, expect } from 'vitest';
import { ExpensesService } from '../src/modules/expenses/expenses.service';

describe('ExpensesService (Split Calculation Logic)', () => {
  it('correctly splits equal amounts evenly when divisible', () => {
    // ₹1200 split 3 ways = 400 each
    const splits = [
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' }
    ];

    const result = ExpensesService.calculateSplits(120000, 'EQUAL', splits);

    expect(result).toEqual([
      { userId: 'u1', amountOwed: 40000 },
      { userId: 'u2', amountOwed: 40000 },
      { userId: 'u3', amountOwed: 40000 }
    ]);
    const sum = result.reduce((a, b) => a + b.amountOwed, 0);
    expect(sum).toBe(120000);
  });

  it('correctly allocates rounding remainder cents during equal split', () => {
    // 1000 minor units split 3 ways: 1000 / 3 = 333 remainder 1
    // Remainder cent must go to first participant, yielding exactly 1000
    const splits = [
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' }
    ];

    const result = ExpensesService.calculateSplits(1000, 'EQUAL', splits);

    expect(result).toEqual([
      { userId: 'u1', amountOwed: 334 },
      { userId: 'u2', amountOwed: 333 },
      { userId: 'u3', amountOwed: 333 }
    ]);
    const sum = result.reduce((a, b) => a + b.amountOwed, 0);
    expect(sum).toBe(1000);
  });

  it('correctly supports exact split when amounts sum to total', () => {
    const splits = [
      { userId: 'u1', amountOwed: 50000 },
      { userId: 'u2', amountOwed: 40000 },
      { userId: 'u3', amountOwed: 30000 }
    ];

    const result = ExpensesService.calculateSplits(120000, 'EXACT', splits);
    expect(result).toEqual(splits);
  });

  it('rejects exact split if sum does not match total', () => {
    const splits = [
      { userId: 'u1', amountOwed: 50000 },
      { userId: 'u2', amountOwed: 40000 }
    ];

    expect(() => ExpensesService.calculateSplits(120000, 'EXACT', splits)).toThrow();
  });

  it('correctly calculates percentage split and adjusts rounding discrepancies', () => {
    // 50%, 30%, 20% on 120000 = 60000, 36000, 24000
    const splits = [
      { userId: 'u1', percentage: 50 },
      { userId: 'u2', percentage: 30 },
      { userId: 'u3', percentage: 20 }
    ];

    const result = ExpensesService.calculateSplits(120000, 'PERCENTAGE', splits);

    expect(result).toEqual([
      { userId: 'u1', amountOwed: 60000 },
      { userId: 'u2', amountOwed: 36000 },
      { userId: 'u3', amountOwed: 24000 }
    ]);
    const sum = result.reduce((a, b) => a + b.amountOwed, 0);
    expect(sum).toBe(120000);
  });

  it('handles percentage split with fractional cent rounding', () => {
    // 33.33%, 33.33%, 33.34% on 1000
    const splits = [
      { userId: 'u1', percentage: 33.33 },
      { userId: 'u2', percentage: 33.33 },
      { userId: 'u3', percentage: 33.34 }
    ];

    const result = ExpensesService.calculateSplits(1000, 'PERCENTAGE', splits);
    const sum = result.reduce((a, b) => a + b.amountOwed, 0);
    expect(sum).toBe(1000);
  });

  it('supports self-only expense correctly', () => {
    const splits = [{ userId: 'u1' }];
    const result = ExpensesService.calculateSplits(5000, 'EQUAL', splits);
    expect(result).toEqual([{ userId: 'u1', amountOwed: 5000 }]);
  });
});
