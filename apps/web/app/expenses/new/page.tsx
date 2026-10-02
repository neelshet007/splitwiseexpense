'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { GroupItem, FriendItem, SplitType } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  User,
  Users,
  Sparkles,
  ArrowRight
} from 'lucide-react';

function AddExpenseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get('groupId') || '';
  const initialFriendId = searchParams.get('friendId') || '';
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Mode: 'FRIEND' (1-to-1 direct) or 'GROUP'
  const [splitMode, setSplitMode] = useState<'FRIEND' | 'GROUP'>(
    initialGroupId ? 'GROUP' : initialFriendId ? 'FRIEND' : 'FRIEND'
  );

  // Common inputs
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [fullAmountSubMode, setFullAmountSubMode] = useState<'EQUAL' | 'PERCENTAGE' | 'CUSTOM'>('EQUAL');
  const [serverError, setServerError] = useState<string | null>(null);

  // 1-to-1 Friend Mode state
  const [selectedFriendId, setSelectedFriendId] = useState(initialFriendId);

  // Group Mode state
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});

  // 1. Fetch Friends
  const { data: friends, isLoading: friendsLoading } = useQuery<FriendItem[]>({
    queryKey: ['friends'],
    queryFn: () => apiFetch<FriendItem[]>('/api/friends')
  });

  // 2. Fetch Groups
  const { data: groups, isLoading: groupsLoading } = useQuery<GroupItem[]>({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupItem[]>('/api/groups')
  });

  // Auto-select first friend if available
  useEffect(() => {
    if (friends && friends.length > 0 && !selectedFriendId) {
      setSelectedFriendId(friends[0].friendId);
    }
  }, [friends, selectedFriendId]);

  // Active selected group
  const activeGroup = groups?.find((g) => g.id === selectedGroupId) || groups?.[0];

  useEffect(() => {
    if (activeGroup) {
      if (!selectedGroupId) setSelectedGroupId(activeGroup.id);
      if (!paidBy && user) setPaidBy(user.id);

      // Select all members by default
      const initialSelected: Record<string, boolean> = {};
      (activeGroup.members || []).forEach((m) => {
        initialSelected[m.userId] = true;
      });
      setSelectedMembers(initialSelected);
    }
  }, [activeGroup, paidBy, user, selectedGroupId]);

  // Selected friend object & amount in minor units
  const activeFriend = friends?.find((f) => f.friendId === selectedFriendId);
  const totalAmountMinor = Math.round((parseFloat(amountStr) || 0) * 100);

  // Effective payer
  const effectivePayerId = paidBy || user?.id || '';
  const isPayer = effectivePayerId === user?.id;
  const payerName =
    effectivePayerId === user?.id
      ? 'You'
      : splitMode === 'FRIEND'
      ? activeFriend?.friend.name || 'Friend'
      : activeGroup?.members?.find((m) => m.userId === effectivePayerId)?.user?.name || 'Member';

  // In Full Amount group mode, adjust selection so payer is not in debtors by default
  useEffect(() => {
    if (splitType === 'FULL_AMOUNT' && splitMode === 'GROUP' && activeGroup) {
      setSelectedMembers((prev) => {
        const next = { ...prev };
        if (effectivePayerId) {
          next[effectivePayerId] = false;
        }
        const otherMembers = (activeGroup.members || []).filter((m) => m.userId !== effectivePayerId);
        const anySelected = otherMembers.some((m) => next[m.userId]);
        if (!anySelected) {
          otherMembers.forEach((m) => {
            next[m.userId] = true;
          });
        }
        return next;
      });
    }
  }, [splitType, splitMode, activeGroup, effectivePayerId]);

  // Helper to initialize or sync custom amounts & percentages
  useEffect(() => {
    if (totalAmountMinor > 0) {
      if (splitMode === 'FRIEND' && activeFriend && user) {
        if (!exactAmounts[user.id] && !exactAmounts[activeFriend.friendId]) {
          const half = (totalAmountMinor / 200).toFixed(2);
          setExactAmounts({
            [user.id]: half,
            [activeFriend.friendId]: half
          });
        }
        if (!percentages[user.id] && !percentages[activeFriend.friendId]) {
          setPercentages({
            [user.id]: '50',
            [activeFriend.friendId]: '50'
          });
        }
      } else if (splitMode === 'GROUP' && activeGroup) {
        const targetIds =
          splitType === 'FULL_AMOUNT'
            ? Object.keys(selectedMembers).filter((id) => selectedMembers[id] && id !== effectivePayerId)
            : Object.keys(selectedMembers).filter((id) => selectedMembers[id]);

        if (targetIds.length > 0) {
          const perPerson = (totalAmountMinor / (targetIds.length * 100)).toFixed(2);
          const perPct = (100 / targetIds.length).toFixed(1);
          setExactAmounts((prev) => {
            const next = { ...prev };
            targetIds.forEach((id) => {
              if (!next[id]) next[id] = perPerson;
            });
            return next;
          });
          setPercentages((prev) => {
            const next = { ...prev };
            targetIds.forEach((id) => {
              if (!next[id]) next[id] = perPct;
            });
            return next;
          });
        }
      }
    }
  }, [totalAmountMinor, splitMode, activeFriend, user, activeGroup, selectedMembers, splitType, effectivePayerId]);

  // Calculate Splits
  let calculatedSplits: { userId: string; name: string; amountOwed: number; pct?: number }[] = [];
  let validationError: string | null = null;

  if (splitMode === 'FRIEND' && activeFriend && user && totalAmountMinor > 0) {
    if (splitType === 'EQUAL') {
      const base = Math.floor(totalAmountMinor / 2);
      const remainder = totalAmountMinor % 2;

      calculatedSplits = [
        {
          userId: user.id,
          name: 'You',
          amountOwed: base + remainder,
          pct: 50
        },
        {
          userId: activeFriend.friendId,
          name: activeFriend.friend.name,
          amountOwed: base,
          pct: 50
        }
      ];
    } else if (splitType === 'EXACT') {
      const myAmount = Math.round((parseFloat(exactAmounts[user.id] || '0') || 0) * 100);
      const friendAmount = Math.round((parseFloat(exactAmounts[activeFriend.friendId] || '0') || 0) * 100);

      calculatedSplits = [
        { userId: user.id, name: 'You', amountOwed: myAmount },
        { userId: activeFriend.friendId, name: activeFriend.friend.name, amountOwed: friendAmount }
      ];

      const sum = myAmount + friendAmount;
      if (sum !== totalAmountMinor) {
        const diff = (totalAmountMinor - sum) / 100;
        validationError =
          diff > 0
            ? `₹${diff.toFixed(2)} left to allocate (Sum: ₹${(sum / 100).toFixed(2)} / ₹${(totalAmountMinor / 100).toFixed(2)})`
            : `₹${Math.abs(diff).toFixed(2)} over allocated (Sum: ₹${(sum / 100).toFixed(2)} / ₹${(totalAmountMinor / 100).toFixed(2)})`;
      }
    } else if (splitType === 'PERCENTAGE') {
      const myPct = parseFloat(percentages[user.id] || '0') || 0;
      const friendPct = parseFloat(percentages[activeFriend.friendId] || '0') || 0;

      const myVal = Math.round((myPct / 100) * totalAmountMinor);
      const friendVal = totalAmountMinor - myVal;

      calculatedSplits = [
        { userId: user.id, name: 'You', amountOwed: myVal, pct: myPct },
        { userId: activeFriend.friendId, name: activeFriend.friend.name, amountOwed: friendVal, pct: friendPct }
      ];

      const totalPct = myPct + friendPct;
      if (Math.abs(totalPct - 100) > 0.01) {
        validationError = `Percentages sum to ${totalPct.toFixed(1)}% (must equal 100%)`;
      }
    } else if (splitType === 'FULL_AMOUNT') {
      const debtorId = isPayer ? activeFriend.friendId : user.id;
      const debtorName = isPayer ? activeFriend.friend.name : 'You';

      calculatedSplits = [
        {
          userId: effectivePayerId,
          name: payerName,
          amountOwed: 0,
          pct: 0
        },
        {
          userId: debtorId,
          name: debtorName,
          amountOwed: totalAmountMinor,
          pct: 100
        }
      ];
    }
  } else if (splitMode === 'GROUP' && activeGroup && totalAmountMinor > 0) {
    const activeParticipantIds = Object.keys(selectedMembers).filter((id) => selectedMembers[id]);

    if (splitType === 'FULL_AMOUNT') {
      const owedMemberIds = activeParticipantIds.filter((id) => id !== effectivePayerId);

      if (owedMemberIds.length === 0) {
        validationError = `Please select at least one person who owes this expense to ${payerName}.`;
      } else if (owedMemberIds.length === 1) {
        const singleDebtorId = owedMemberIds[0];
        const member = (activeGroup.members || []).find((m) => m.userId === singleDebtorId);
        calculatedSplits = [
          {
            userId: effectivePayerId,
            name: payerName,
            amountOwed: 0,
            pct: 0
          },
          {
            userId: singleDebtorId,
            name: member?.user.name || 'Member',
            amountOwed: totalAmountMinor,
            pct: 100
          }
        ];
      } else {
        if (fullAmountSubMode === 'EQUAL') {
          const count = owedMemberIds.length;
          const base = Math.floor(totalAmountMinor / count);
          const remainder = totalAmountMinor % count;

          const debtorSplits = owedMemberIds.map((id, index) => {
            const member = (activeGroup.members || []).find((m) => m.userId === id);
            return {
              userId: id,
              name: member?.user.name || 'Member',
              amountOwed: index < remainder ? base + 1 : base,
              pct: parseFloat((100 / count).toFixed(1))
            };
          });

          calculatedSplits = [
            { userId: effectivePayerId, name: payerName, amountOwed: 0, pct: 0 },
            ...debtorSplits
          ];
        } else if (fullAmountSubMode === 'CUSTOM') {
          let sumMinor = 0;
          const debtorSplits = owedMemberIds.map((id) => {
            const member = (activeGroup.members || []).find((m) => m.userId === id);
            const val = Math.round((parseFloat(exactAmounts[id] || '0') || 0) * 100);
            sumMinor += val;
            return {
              userId: id,
              name: member?.user.name || 'Member',
              amountOwed: val
            };
          });

          calculatedSplits = [
            { userId: effectivePayerId, name: payerName, amountOwed: 0, pct: 0 },
            ...debtorSplits
          ];

          if (sumMinor !== totalAmountMinor) {
            const diff = (totalAmountMinor - sumMinor) / 100;
            validationError =
              diff > 0
                ? `₹${diff.toFixed(2)} left to allocate (Sum: ₹${(sumMinor / 100).toFixed(2)} / ₹${(totalAmountMinor / 100).toFixed(2)})`
                : `₹${Math.abs(diff).toFixed(2)} over allocated (Sum: ₹${(sumMinor / 100).toFixed(2)} / ₹${(totalAmountMinor / 100).toFixed(2)})`;
          }
        } else if (fullAmountSubMode === 'PERCENTAGE') {
          let sumPct = 0;
          let allocatedSum = 0;
          let maxIdx = 0;
          let maxVal = -1;

          const debtorSplits = owedMemberIds.map((id, idx) => {
            const member = (activeGroup.members || []).find((m) => m.userId === id);
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
              amountOwed: val,
              pct
            };
          });

          const disc = totalAmountMinor - allocatedSum;
          if (disc !== 0 && debtorSplits.length > 0) {
            debtorSplits[maxIdx].amountOwed += disc;
          }

          if (Math.abs(sumPct - 100) > 0.01) {
            validationError = `Percentages sum to ${sumPct.toFixed(1)}% (must equal 100%)`;
          }

          calculatedSplits = [
            { userId: effectivePayerId, name: payerName, amountOwed: 0, pct: 0 },
            ...debtorSplits
          ];
        }
      }
    } else {
      if (activeParticipantIds.length === 0) {
        validationError = 'Please select at least one group member.';
      } else if (splitType === 'EQUAL') {
        const count = activeParticipantIds.length;
        const base = Math.floor(totalAmountMinor / count);
        const remainder = totalAmountMinor % count;

        calculatedSplits = activeParticipantIds.map((id, index) => {
          const member = (activeGroup.members || []).find((m) => m.userId === id);
          return {
            userId: id,
            name: member?.user.name || 'Member',
            amountOwed: index < remainder ? base + 1 : base,
            pct: parseFloat((100 / count).toFixed(1))
          };
        });
      } else if (splitType === 'EXACT') {
        let sumMinor = 0;
        calculatedSplits = activeParticipantIds.map((id) => {
          const member = (activeGroup.members || []).find((m) => m.userId === id);
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
          validationError =
            diff > 0
              ? `₹${diff.toFixed(2)} left to allocate (Sum: ₹${(sumMinor / 100).toFixed(2)} / ₹${(totalAmountMinor / 100).toFixed(2)})`
              : `₹${Math.abs(diff).toFixed(2)} over allocated (Sum: ₹${(sumMinor / 100).toFixed(2)} / ₹${(totalAmountMinor / 100).toFixed(2)})`;
        }
      } else if (splitType === 'PERCENTAGE') {
        let sumPct = 0;
        let allocatedSum = 0;
        let maxIdx = 0;
        let maxVal = -1;

        calculatedSplits = activeParticipantIds.map((id, idx) => {
          const member = (activeGroup.members || []).find((m) => m.userId === id);
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
            amountOwed: val,
            pct
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
  }

  // Perspective calculation for logged-in user
  const mySplit = calculatedSplits.find((s) => s.userId === user?.id);
  const myShare = mySplit ? mySplit.amountOwed : 0;
  const amountPaidByUser = isPayer ? totalAmountMinor : 0;
  const userNetBalance = amountPaidByUser - myShare;

  // Active owed members list for Full Amount mode
  const activeDebtorIds =
    splitMode === 'GROUP'
      ? Object.keys(selectedMembers).filter((id) => selectedMembers[id] && id !== effectivePayerId)
      : [];

  // Mutation
  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['group-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });

      if (splitMode === 'GROUP' && selectedGroupId) {
        router.push(`/groups/${selectedGroupId}`);
      } else {
        router.push('/dashboard');
      }
    },
    onError: (err: any) => {
      setServerError(err.message || 'Failed to create expense');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmountMinor <= 0 || validationError || calculatedSplits.length === 0) return;

    const payload = {
      groupId: splitMode === 'GROUP' ? selectedGroupId : null,
      description: description.trim(),
      totalAmount: totalAmountMinor,
      splitType,
      paidBy: effectivePayerId,
      splits: calculatedSplits.map((s) => ({
        userId: s.userId,
        amountOwed: s.amountOwed,
        percentage: splitType === 'PERCENTAGE' ? s.pct : undefined
      }))
    };

    setServerError(null);
    createExpenseMutation.mutate(payload);
  };

  return (
    <div className="px-5 pt-6 pb-20">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Add Expense</h1>
          <p className="text-xs text-slate-400">Record a shared purchase</p>
        </div>
      </div>

      {serverError && (
        <div className="mb-5 p-3.5 bg-red-50 text-red-700 text-xs font-medium rounded-2xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Target Selector: 1-to-1 Friend or Group */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => setSplitMode('FRIEND')}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            splitMode === 'FRIEND'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>With Friend (1-on-1)</span>
        </button>
        <button
          type="button"
          onClick={() => setSplitMode('GROUP')}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            splitMode === 'GROUP'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>In a Group</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Recipient / Group Choice */}
        {splitMode === 'FRIEND' ? (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Choose Friend
            </label>
            {friendsLoading ? (
              <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
            ) : !friends || friends.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-center">
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">No friends found yet.</p>
                <Link
                  href="/friends"
                  className="inline-block px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold"
                >
                  Add a friend by email
                </Link>
              </div>
            ) : (
              <select
                value={selectedFriendId}
                onChange={(e) => setSelectedFriendId(e.target.value)}
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {friends.map((f) => (
                  <option key={f.friendId} value={f.friendId}>
                    {f.friend.name} ({f.friend.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Choose Group
            </label>
            {groupsLoading ? (
              <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
            ) : !groups || groups.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-center">
                <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">No active groups yet.</p>
                <Link
                  href="/groups"
                  className="inline-block px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold"
                >
                  Create a Group
                </Link>
              </div>
            ) : (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({(g.members || []).length} members)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Expense Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dinner, Cab, Coffee, Groceries"
            required
            className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Total Amount (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">₹</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              required
              className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Paid By Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Paid By (Who paid the bill?)
          </label>
          {splitMode === 'FRIEND' ? (
            <select
              value={paidBy || user?.id}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={user?.id}>You paid the full amount</option>
              {activeFriend && <option value={activeFriend.friendId}>{activeFriend.friend.name} paid the full amount</option>}
            </select>
          ) : (
            <select
              value={paidBy || user?.id}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {(activeGroup?.members || []).map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name} {m.userId === user?.id ? '(You paid)' : 'paid the bill'}
                </option>
              ))}
            </select>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            Paid by represents who paid the bill. Splitting represents each person&apos;s responsibility.
          </p>
        </div>

        {/* Four User-Facing Split Modes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Split Mode (How is this expense shared?)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { type: 'EQUAL' as SplitType, label: 'Equal', hint: 'Divide equally' },
              { type: 'PERCENTAGE' as SplitType, label: 'Percentage', hint: '100% total' },
              { type: 'EXACT' as SplitType, label: 'Custom', hint: 'Custom ₹' },
              { type: 'FULL_AMOUNT' as SplitType, label: 'Full Amount', hint: 'Paid for others' }
            ].map(({ type, label, hint }) => (
              <button
                key={type}
                type="button"
                onClick={() => setSplitType(type)}
                className={`py-2 px-1 text-center rounded-xl border transition-all ${
                  splitType === type
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-500 dark:border-emerald-500 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <span className="block text-xs font-bold">{label}</span>
                <span className={`block text-[10px] mt-0.5 ${splitType === type ? 'text-slate-300 dark:text-emerald-100' : 'text-slate-400'}`}>
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 1. FRIEND MODE - FULL AMOUNT */}
        {splitMode === 'FRIEND' && activeFriend && user && splitType === 'FULL_AMOUNT' && (
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                &ldquo;I paid the full amount for someone else.&rdquo;
              </span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              {isPayer
                ? `You paid the entire ${formatMinorCurrency(totalAmountMinor || 0)}. ${activeFriend.friend.name} owes you the full 100%.`
                : `${activeFriend.friend.name} paid the entire ${formatMinorCurrency(totalAmountMinor || 0)}. You owe ${activeFriend.friend.name} the full 100%.`}
            </p>
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {isPayer ? `${activeFriend.friend.name}'s share` : 'Your share'}
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatMinorCurrency(totalAmountMinor || 0)} (100%)
              </span>
            </div>
          </div>
        )}

        {/* 2. FRIEND MODE - CUSTOM (EXACT) */}
        {splitMode === 'FRIEND' && activeFriend && user && splitType === 'EXACT' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Custom Responsibility Amounts (₹)
              </label>
              <span className="text-[11px] text-slate-500">
                Total: {formatMinorCurrency(totalAmountMinor)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Your share (You)
                </span>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={exactAmounts[user.id] || ''}
                    onChange={(e) =>
                      setExactAmounts((prev) => ({
                        ...prev,
                        [user.id]: e.target.value
                      }))
                    }
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {activeFriend.friend.name}&apos;s share
                </span>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={exactAmounts[activeFriend.friendId] || ''}
                    onChange={(e) =>
                      setExactAmounts((prev) => ({
                        ...prev,
                        [activeFriend.friendId]: e.target.value
                      }))
                    }
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. FRIEND MODE - PERCENTAGE */}
        {splitMode === 'FRIEND' && activeFriend && user && splitType === 'PERCENTAGE' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Split by Percentage (%)
              </label>
              <span className="text-[11px] text-slate-500">
                Must total 100%
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                    Your share
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    → {formatMinorCurrency(calculatedSplits.find((s) => s.userId === user.id)?.amountOwed || 0)}
                  </span>
                </div>
                <div className="relative w-28">
                  <input
                    type="number"
                    step="0.1"
                    value={percentages[user.id] || ''}
                    onChange={(e) =>
                      setPercentages((prev) => ({
                        ...prev,
                        [user.id]: e.target.value
                      }))
                    }
                    placeholder="50"
                    className="w-full pr-7 pl-3 py-1.5 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                    {activeFriend.friend.name}&apos;s share
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    → {formatMinorCurrency(calculatedSplits.find((s) => s.userId === activeFriend.friendId)?.amountOwed || 0)}
                  </span>
                </div>
                <div className="relative w-28">
                  <input
                    type="number"
                    step="0.1"
                    value={percentages[activeFriend.friendId] || ''}
                    onChange={(e) =>
                      setPercentages((prev) => ({
                        ...prev,
                        [activeFriend.friendId]: e.target.value
                      }))
                    }
                    placeholder="50"
                    className="w-full pr-7 pl-3 py-1.5 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. GROUP MODE - FULL AMOUNT */}
        {splitMode === 'GROUP' && activeGroup && splitType === 'FULL_AMOUNT' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  &ldquo;I paid the full amount for someone else.&rdquo;
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                {payerName} paid the entire {formatMinorCurrency(totalAmountMinor || 0)}. Select the member(s) who owe this expense below.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Owed by (Who should pay back {payerName}?)
              </label>
              <div className="space-y-2">
                {(activeGroup.members || [])
                  .filter((m) => m.userId !== effectivePayerId)
                  .map((m) => {
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
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {m.user.name} {m.userId === user?.id && '(You)'}
                          </span>
                        </label>

                        {isSelected && (
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {splitResult ? formatMinorCurrency(splitResult.amountOwed) : '₹0'}
                            </span>
                            {splitResult?.pct !== undefined && (
                              <span className="block text-[10px] text-slate-400">
                                {splitResult.pct}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* If multiple debtors are selected, show sub-split mode options */}
            {activeDebtorIds.length > 1 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Split among owed members:
                  </span>
                  <div className="flex items-center gap-1">
                    {(['EQUAL', 'PERCENTAGE', 'CUSTOM'] as const).map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setFullAmountSubMode(sub)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                          fullAmountSubMode === sub
                            ? 'bg-slate-900 text-white dark:bg-emerald-500 shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {sub === 'EQUAL' ? 'Equal' : sub === 'PERCENTAGE' ? 'Percentage' : 'Custom'}
                      </button>
                    ))}
                  </div>
                </div>

                {fullAmountSubMode === 'CUSTOM' && (
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                    {activeDebtorIds.map((id) => {
                      const member = (activeGroup.members || []).find((m) => m.userId === id);
                      return (
                        <div key={id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                            {member?.user.name} {id === user?.id && '(You)'}
                          </span>
                          <div className="relative w-32">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              value={exactAmounts[id] || ''}
                              onChange={(e) =>
                                setExactAmounts((prev) => ({
                                  ...prev,
                                  [id]: e.target.value
                                }))
                              }
                              placeholder="0.00"
                              className="w-full pl-6 pr-2 py-1.5 text-xs text-right font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {fullAmountSubMode === 'PERCENTAGE' && (
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                    {activeDebtorIds.map((id) => {
                      const member = (activeGroup.members || []).find((m) => m.userId === id);
                      const splitResult = calculatedSplits.find((s) => s.userId === id);
                      return (
                        <div key={id} className="flex items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300 block">
                              {member?.user.name} {id === user?.id && '(You)'}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              → {splitResult ? formatMinorCurrency(splitResult.amountOwed) : '₹0'}
                            </span>
                          </div>
                          <div className="relative w-24">
                            <input
                              type="number"
                              step="0.1"
                              value={percentages[id] || ''}
                              onChange={(e) =>
                                setPercentages((prev) => ({
                                  ...prev,
                                  [id]: e.target.value
                                }))
                              }
                              placeholder="50"
                              className="w-full pr-6 pl-2 py-1.5 text-xs text-right font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. GROUP MODE - EQUAL / CUSTOM / PERCENTAGE */}
        {splitMode === 'GROUP' && activeGroup && splitType !== 'FULL_AMOUNT' && (
          <div className="pt-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Split Between Group Members
            </label>
            <div className="space-y-2">
              {(activeGroup.members || []).map((m) => {
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
                      <div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {m.user.name} {m.userId === user?.id && '(You)'}
                        </span>
                        {splitType === 'PERCENTAGE' && isSelected && (
                          <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            → {splitResult ? formatMinorCurrency(splitResult.amountOwed) : '₹0'}
                          </span>
                        )}
                      </div>
                    </label>

                    {isSelected && (
                      <div className="w-32 text-right">
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
                              placeholder="0.00"
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
        )}

        {/* Live 4-Way Balance Breakdown Card */}
        {totalAmountMinor > 0 && calculatedSplits.length > 0 && (
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Clear Balance Breakdown
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">
                Total: {formatMinorCurrency(totalAmountMinor)}
              </span>
            </div>

            {/* Distinguish all 4 key accounting metrics clearly */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] text-slate-400 block font-medium">Paid by</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                  {payerName}
                </span>
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  {formatMinorCurrency(totalAmountMinor)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] text-slate-400 block font-medium">Your share</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {formatMinorCurrency(myShare)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {totalAmountMinor > 0 ? `${((myShare / totalAmountMinor) * 100).toFixed(0)}% of total` : '0%'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] text-slate-400 block font-medium">You owe</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 block mt-0.5">
                  {userNetBalance < 0 ? formatMinorCurrency(Math.abs(userNetBalance)) : '₹0'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {userNetBalance < 0 ? `to ${payerName}` : 'Settled'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] text-slate-400 block font-medium">You are owed</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {userNetBalance > 0 ? formatMinorCurrency(userNetBalance) : '₹0'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {userNetBalance > 0 ? 'from others' : 'None'}
                </span>
              </div>
            </div>

            {/* Individual Settlements Summary for this expense */}
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                Expense Settlement Result
              </span>
              <div className="space-y-1.5">
                {calculatedSplits
                  .filter((s) => s.userId !== effectivePayerId && s.amountOwed > 0)
                  .map((s) => (
                    <div key={s.userId} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {s.userId === user?.id ? 'You' : s.name}
                        </strong>{' '}
                        owes{' '}
                        <strong className="text-slate-900 dark:text-white font-semibold">
                          {payerName}
                        </strong>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatMinorCurrency(s.amountOwed)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3.5 bg-amber-50 text-amber-800 text-xs font-medium rounded-2xl border border-amber-200">
            ⚠️ {validationError}
          </div>
        )}

        {/* Submit Action */}
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
              <span>Add Expense</span>
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
