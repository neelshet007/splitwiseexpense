'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { GroupItem, SplitType } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency } from '@/lib/utils';
import { ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';

function AddExpenseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get('groupId') || '';
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch all groups
  const { data: groups, isLoading: groupsLoading } = useQuery<GroupItem[]>({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupItem[]>('/api/groups')
  });

  // Current selected group
  const activeGroup = groups?.find((g) => g.id === selectedGroupId) || groups?.[0];

  useEffect(() => {
    if (activeGroup) {
      setSelectedGroupId(activeGroup.id);
      if (!paidBy && user) {
        setPaidBy(user.id);
      }
      // Select all members by default
      const initialSelected: Record<string, boolean> = {};
      activeGroup.members.forEach((m) => {
        initialSelected[m.userId] = true;
      });
      setSelectedMembers(initialSelected);
    }
  }, [activeGroup, paidBy, user]);

  const totalAmountMinor = Math.round((parseFloat(amountStr) || 0) * 100);
  const activeParticipantIds = Object.keys(selectedMembers).filter((id) => selectedMembers[id]);

  // Real-time split calculations
  let calculatedSplits: { userId: string; name: string; amountOwed: number }[] = [];
  let validationError: string | null = null;

  if (totalAmountMinor > 0 && activeParticipantIds.length > 0 && activeGroup) {
    if (splitType === 'EQUAL') {
      const count = activeParticipantIds.length;
      const base = Math.floor(totalAmountMinor / count);
      const remainder = totalAmountMinor % count;

      calculatedSplits = activeParticipantIds.map((id, index) => {
        const member = activeGroup.members.find((m) => m.userId === id);
        return {
          userId: id,
          name: member?.user.name || 'Member',
          amountOwed: index < remainder ? base + 1 : base
        };
      });
    } else if (splitType === 'EXACT') {
      let sumMinor = 0;
      calculatedSplits = activeParticipantIds.map((id) => {
        const member = activeGroup.members.find((m) => m.userId === id);
        const val = Math.round((parseFloat(exactAmounts[id] || '0') || 0) * 100);
        sumMinor += val;
        return {
          userId: id,
          name: member?.user.name || 'Member',
          amountOwed: val
        };
      });

      if (sumMinor !== totalAmountMinor) {
        const diff = (totalAmountMinor - sumMinor) / 100;
        validationError = diff > 0 ? `₹${diff.toFixed(2)} left to allocate` : `₹${Math.abs(diff).toFixed(2)} over allocated`;
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      let allocatedSum = 0;
      let maxIdx = 0;
      let maxVal = -1;

      calculatedSplits = activeParticipantIds.map((id, idx) => {
        const member = activeGroup.members.find((m) => m.userId === id);
        const pct = parseFloat(percentages[id] || '0') || 0;
        sumPct += pct;
        if (pct > maxVal) {
          maxVal = pct;
          maxIdx = idx;
        }
        const val = Math.round((pct / 100) * totalAmountMinor);
        allocatedSum += val;
        return {
          userId: id,
          name: member?.user.name || 'Member',
          amountOwed: val
        };
      });

      const disc = totalAmountMinor - allocatedSum;
      if (disc !== 0 && calculatedSplits.length > 0) {
        calculatedSplits[maxIdx].amountOwed += disc;
      }

      if (Math.abs(sumPct - 100) > 0.01) {
        validationError = `Percentages sum to ${sumPct.toFixed(1)}% (must equal 100%)`;
      }
    }
  }

  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch(`/api/groups/${selectedGroupId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-expenses', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['group-balances', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['group-settlements', selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      router.push(`/groups/${selectedGroupId}`);
    },
    onError: (err: any) => {
      setServerError(err.message || 'Failed to create expense');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmountMinor <= 0 || activeParticipantIds.length === 0 || validationError) return;

    const payload = {
      description: description.trim(),
      totalAmount: totalAmountMinor,
      splitType,
      paidBy,
      splits: calculatedSplits.map((s) => ({
        userId: s.userId,
        amountOwed: s.amountOwed,
        percentage: splitType === 'PERCENTAGE' ? parseFloat(percentages[s.userId] || '0') : undefined
      }))
    };

    setServerError(null);
    createExpenseMutation.mutate(payload);
  };

  if (groupsLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="px-5 pt-8 text-center">
        <p className="text-sm text-slate-500 mb-4">You need to be in a group to add an expense.</p>
        <Link href="/groups" className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-semibold">
          Go to Groups
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={selectedGroupId ? `/groups/${selectedGroupId}` : '/dashboard'}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Add Expense</h1>
      </div>

      {serverError && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select Group */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Group
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.members.length} members)
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            What was it for?
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dinner, Cab, Groceries, Movie"
            required
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Amount (₹)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
            <input
              type="number"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              required
              className="w-full pl-9 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xl font-bold text-slate-900 dark:text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Paid by */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Paid by
          </label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {activeGroup?.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name} {m.userId === user?.id && '(You)'}
              </option>
            ))}
          </select>
        </div>

        {/* Split Type Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Split Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['EQUAL', 'EXACT', 'PERCENTAGE'] as SplitType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSplitType(type)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  splitType === type
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-500 dark:border-emerald-500'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {type === 'EQUAL' ? 'Equal' : type === 'EXACT' ? 'Exact ₹' : 'Percent %'}
              </button>
            ))}
          </div>
        </div>

        {/* Participants Selection & Breakdown */}
        <div className="pt-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Split Between ({activeParticipantIds.length} selected)
          </label>
          <div className="space-y-2">
            {activeGroup?.members.map((m) => {
              const isSelected = !!selectedMembers[m.userId];
              const splitResult = calculatedSplits.find((s) => s.userId === m.userId);

              return (
                <div
                  key={m.userId}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        setSelectedMembers((prev) => ({
                          ...prev,
                          [m.userId]: e.target.checked
                        }))
                      }
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 accent-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {m.user.name} {m.userId === user?.id && '(You)'}
                    </span>
                  </label>

                  {/* Input or Calculated Display */}
                  {isSelected && (
                    <div className="w-28 text-right">
                      {splitType === 'EQUAL' && (
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {splitResult ? formatMinorCurrency(splitResult.amountOwed) : '₹0'}
                        </span>
                      )}

                      {splitType === 'EXACT' && (
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={exactAmounts[m.userId] || ''}
                            onChange={(e) =>
                              setExactAmounts((prev) => ({
                                ...prev,
                                [m.userId]: e.target.value
                              }))
                            }
                            placeholder="0"
                            className="w-full pl-5 pr-2 py-1.5 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}

                      {splitType === 'PERCENTAGE' && (
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={percentages[m.userId] || ''}
                            onChange={(e) =>
                              setPercentages((prev) => ({
                                ...prev,
                                [m.userId]: e.target.value
                              }))
                            }
                            placeholder="0"
                            className="w-full pr-5 pl-2 py-1.5 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 bg-amber-50 text-amber-800 text-xs font-medium rounded-xl border border-amber-200">
            ⚠️ {validationError}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={createExpenseMutation.isPending || totalAmountMinor <= 0 || !!validationError}
          className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none mt-4"
        >
          {createExpenseMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>Save Expense</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function AddExpensePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-center text-xs">Loading form...</div>}>
        <AddExpenseForm />
      </Suspense>
    </AppShell>
  );
}
