import { describe, it, expect } from 'vitest';
import { SettlementService } from '../src/modules/balances/settlements.service';
import { UserBalance } from '@splitwise/types';

describe('SettlementService (Debt Simplification Engine)', () => {
  it('correctly simplifies debts according to the prompt scenario (Neel +1500, Rahul -1200, Aman -300)', () => {
    const balances: UserBalance[] = [
      { userId: 'u1', userName: 'Neel', email: 'neel@example.com', totalPaid: 3000, totalShare: 1500, netBalance: 1500 },
      { userId: 'u2', userName: 'Rahul', email: 'rahul@example.com', totalPaid: 0, totalShare: 1200, netBalance: -1200 },
      { userId: 'u3', userName: 'Aman', email: 'aman@example.com', totalPaid: 0, totalShare: 300, netBalance: -300 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);

    expect(settlements).toHaveLength(2);
    // Rahul owes Neel 1200
    expect(settlements).toContainEqual({
      fromUserId: 'u2',
      fromUserName: 'Rahul',
      toUserId: 'u1',
      toUserName: 'Neel',
      amount: 1200
    });
    // Aman owes Neel 300
    expect(settlements).toContainEqual({
      fromUserId: 'u3',
      fromUserName: 'Aman',
      toUserId: 'u1',
      toUserName: 'Neel',
      amount: 300
    });
  });

  it('handles zero balances without generating settlements', () => {
    const balances: UserBalance[] = [
      { userId: 'u1', userName: 'Neel', email: 'neel@example.com', totalPaid: 500, totalShare: 500, netBalance: 0 },
      { userId: 'u2', userName: 'Rahul', email: 'rahul@example.com', totalPaid: 500, totalShare: 500, netBalance: 0 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);
    expect(settlements).toEqual([]);
  });

  it('handles circular / multi-party debts with minimal transfers', () => {
    // A owes B 100, B owes C 100 -> A should pay C 100 directly
    const balances: UserBalance[] = [
      { userId: 'uA', userName: 'Alice', email: 'a@ex.com', totalPaid: 0, totalShare: 100, netBalance: -100 },
      { userId: 'uB', userName: 'Bob', email: 'b@ex.com', totalPaid: 100, totalShare: 100, netBalance: 0 },
      { userId: 'uC', userName: 'Charlie', email: 'c@ex.com', totalPaid: 100, totalShare: 0, netBalance: 100 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      fromUserId: 'uA',
      fromUserName: 'Alice',
      toUserId: 'uC',
      toUserName: 'Charlie',
      amount: 100
    });
  });

  it('handles large amounts accurately without precision loss', () => {
    // ₹10,00,000 in minor units = 100,000,000
    const balances: UserBalance[] = [
      { userId: 'u1', userName: 'Neel', email: 'neel@example.com', totalPaid: 100000000, totalShare: 50000000, netBalance: 50000000 },
      { userId: 'u2', userName: 'Rahul', email: 'rahul@example.com', totalPaid: 0, totalShare: 50000000, netBalance: -50000000 }
    ];

    const settlements = SettlementService.simplifyDebts(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0].amount).toBe(50000000);
  });
});
