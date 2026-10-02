import { SettlementTransfer, UserBalance } from '@splitwise/types';

export class SettlementService {
  /**
   * Deterministic Min-Cash-Flow Debt Simplification Algorithm.
   * Converts net balances into the minimal number of direct transfers.
   *
   * Example:
   * Neel: +1500
   * Rahul: -1200
   * Aman: -300
   *
   * Output:
   * Rahul -> Neel 1200
   * Aman  -> Neel 300
   */
  static simplifyDebts(balances: UserBalance[]): SettlementTransfer[] {
    const settlements: SettlementTransfer[] = [];

    // Separate into debtors (netBalance < 0) and creditors (netBalance > 0)
    // Clone objects so we do not mutate inputs
    const debtors: { userId: string; userName: string; balance: number }[] = [];
    const creditors: { userId: string; userName: string; balance: number }[] = [];

    for (const b of balances) {
      if (b.netBalance < 0) {
        debtors.push({ userId: b.userId, userName: b.userName, balance: b.netBalance });
      } else if (b.netBalance > 0) {
        creditors.push({ userId: b.userId, userName: b.userName, balance: b.netBalance });
      }
    }

    // Sort deterministically:
    // Debtors: most negative first (largest debt)
    // Creditors: most positive first (largest credit)
    // Secondary sort by userId for 100% deterministic tie-breaking
    debtors.sort((a, b) => a.balance - b.balance || a.userId.localeCompare(b.userId));
    creditors.sort((a, b) => b.balance - a.balance || a.userId.localeCompare(b.userId));

    let i = 0; // Debtor pointer
    let j = 0; // Creditor pointer

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      // Settle the minimum of what debtor owes and creditor is owed
      const amountToSettle = Math.min(-debtor.balance, creditor.balance);

      if (amountToSettle > 0) {
        settlements.push({
          fromUserId: debtor.userId,
          fromUserName: debtor.userName,
          toUserId: creditor.userId,
          toUserName: creditor.userName,
          amount: amountToSettle
        });

        debtor.balance += amountToSettle;
        creditor.balance -= amountToSettle;
      }

      if (debtor.balance === 0) {
        i++;
      }
      if (creditor.balance === 0) {
        j++;
      }
    }

    return settlements;
  }
}
