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
  UserCheck
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
      activeGroup.members.forEach((m) => {
        initialSelected[m.userId] = true;
      });
      setSelectedMembers(initialSelected);
    }
  }, [activeGroup, paidBy, user, selectedGroupId]);

  // Selected friend object & amount in minor units
  const activeFriend = friends?.find((f) => f.friendId === selectedFriendId);
  const totalAmountMinor = Math.round((parseFloat(amountStr) || 0) * 100);

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
        const activeIds = Object.keys(selectedMembers).filter((id) => selectedMembers[id]);
        if (activeIds.length > 0) {
          const perPerson = (totalAmountMinor / (activeIds.length * 100)).toFixed(2);
          const perPct = (100 / activeIds.length).toFixed(1);
          setExactAmounts((prev) => {
            const next = { ...prev };
            activeIds.forEach((id) => {
              if (!next[id]) next[id] = perPerson;
            });
            return next;
          });
          setPercentages((prev) => {
            const next = { ...prev };
            activeIds.forEach((id) => {
              if (!next[id]) next[id] = perPct;
            });
            return next;
          });
        }
      }
    }
  }, [totalAmountMinor, splitMode, activeFriend, user, activeGroup, selectedMembers]);

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
    }
  } else if (splitMode === 'GROUP' && activeGroup && totalAmountMinor > 0) {
    const activeParticipantIds = Object.keys(selectedMembers).filter((id) => selectedMembers[id]);

    if (activeParticipantIds.length === 0) {
      validationError = 'Please select at least one group member.';
    } else if (splitType === 'EQUAL') {
      const count = activeParticipantIds.length;
      const base = Math.floor(totalAmountMinor / count);
      const remainder = totalAmountMinor % count;

      calculatedSplits = activeParticipantIds.map((id, index) => {
        const member = activeGroup.members.find((m) => m.userId === id);
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

  // Perspective calculation for logged-in user
  const effectivePayerId = paidBy || user?.id;
  const isPayer = effectivePayerId === user?.id;
  const payerName =
    effectivePayerId === user?.id
      ? 'You'
      : splitMode === 'FRIEND'
      ? activeFriend?.friend.name || 'Friend'
      : activeGroup?.members.find((m) => m.userId === effectivePayerId)?.user.name || 'Member';

  const mySplit = calculatedSplits.find((s) => s.userId === user?.id);
  const myShare = mySplit ? mySplit.amountOwed : 0;
  const amountPaidByUser = isPayer ? totalAmountMinor : 0;
  const userNetBalance = amountPaidByUser - myShare;

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

  if (friendsLoading || groupsLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Add Expense</h1>
      </div>

      {/* Mode Selector (Friend vs Group) */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Who is this with?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSplitMode('FRIEND')}
            className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
              splitMode === 'FRIEND'
                ? 'border-slate-900 dark:border-emerald-500 bg-slate-900 text-white dark:bg-emerald-500/10 dark:text-emerald-300 shadow-md'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <div>
              <p className="text-xs font-bold">A Friend</p>
              <p className="text-[10px] opacity-75">Direct 1-to-1 split</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSplitMode('GROUP')}
            className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
              splitMode === 'GROUP'
                ? 'border-slate-900 dark:border-emerald-500 bg-slate-900 text-white dark:bg-emerald-500/10 dark:text-emerald-300 shadow-md'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Users className="w-5 h-5" />
            <div>
              <p className="text-xs font-bold">A Group</p>
              <p className="text-[10px] opacity-75">Trips & flatmates</p>
            </div>
          </button>
        </div>
      </div>

      {serverError && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Choose Target Friend or Group */}
        {splitMode === 'FRIEND' ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Choose Friend
              </label>
              <Link href="/friends" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                + Add new friend
              </Link>
            </div>

            {(!friends || friends.length === 0) ? (
              <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200">
                No friends added yet. Please{' '}
                <Link href="/friends" className="font-bold underline">
                  add a friend
                </Link>{' '}
                first.
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Choose Group
              </label>
              <Link href="/groups" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                + Create new group
              </Link>
            </div>

            {(!groups || groups.length === 0) ? (
              <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200">
                No groups found. Please create a group first.
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            What was it?
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dinner, Cab, Coffee, Groceries"
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

        {/* Paid by (Independent from Split!) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Paid by (Who covered the bill?)
          </label>
          {splitMode === 'FRIEND' ? (
            <select
              value={paidBy || user?.id}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={user?.id}>You paid full amount</option>
              {activeFriend && <option value={activeFriend.friendId}>{activeFriend.friend.name} paid full amount</option>}
            </select>
          ) : (
            <select
              value={paidBy || user?.id}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {activeGroup?.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name} {m.userId === user?.id ? '(You paid)' : 'paid full amount'}
                </option>
              ))}
            </select>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            The person who paid will be credited the full purchase amount.
          </p>
        </div>

        {/* Split Type Selector: Equal / Custom / Percentage */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Split Mode (How is the expense shared?)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { type: 'EQUAL' as SplitType, label: 'Equal' },
              { type: 'EXACT' as SplitType, label: 'Custom' },
              { type: 'PERCENTAGE' as SplitType, label: 'Percentage' }
            ].map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => setSplitType(type)}
                className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                  splitType === type
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-500 dark:border-emerald-500 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Friend Mode Custom or Percentage Inputs */}
        {splitMode === 'FRIEND' && activeFriend && user && (
          <div>
            {splitType === 'EXACT' && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Custom Shares (₹)
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

            {splitType === 'PERCENTAGE' && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Split by Percentage (%)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Total: 100%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                        Your share
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMinorCurrency(calculatedSplits.find((s) => s.userId === user.id)?.amountOwed || 0)}
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
                        {formatMinorCurrency(calculatedSplits.find((s) => s.userId === activeFriend.friendId)?.amountOwed || 0)}
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
          </div>
        )}

        {/* 2. Group Participants Selector & Custom/Percentage inputs */}
        {splitMode === 'GROUP' && (
          <div className="pt-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Split Between Group Members
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

        {/* Live Calculation / Perspective Breakdown Card */}
        {totalAmountMinor > 0 && calculatedSplits.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Clear Balance Breakdown
            </h4>

            {/* Distinguish all 4 key metrics clearly */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Paid by</span>
                <span className="font-bold text-slate-900 dark:text-white truncate block">
                  {payerName} ({formatMinorCurrency(totalAmountMinor)})
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Your share</span>
                <span className="font-bold text-slate-900 dark:text-white block">
                  {formatMinorCurrency(myShare)}
                </span>
              </div>
            </div>

            {/* Net Debt/Credit Status for You */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
              {userNetBalance > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-600 dark:text-slate-400">You are owed</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    +{formatMinorCurrency(userNetBalance)}
                  </span>
                </div>
              ) : userNetBalance < 0 ? (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-600 dark:text-slate-400">You owe ({payerName})</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                    -{formatMinorCurrency(Math.abs(userNetBalance))}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Your balance</span>
                  <span className="font-bold text-slate-500 text-sm">All settled (₹0)</span>
                </div>
              )}
            </div>

            {/* Individual Breakdown for all participants */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 block">Participants Responsibility:</span>
              {calculatedSplits.map((s) => (
                <div key={s.userId} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-none">
                  <span className="text-slate-700 dark:text-slate-300">
                    {s.name} {s.userId === user?.id && '(You)'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatMinorCurrency(s.amountOwed)} {s.pct !== undefined ? `(${s.pct}%)` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 bg-amber-50 text-amber-800 text-xs font-medium rounded-xl border border-amber-200">
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
