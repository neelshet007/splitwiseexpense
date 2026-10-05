'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { GroupItem, FriendItem, TripItem, SplitType } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  User,
  Users,
  Compass,
  Palmtree,
  Sparkles,
  ArrowRight,
  Calendar
} from 'lucide-react';

function AddExpenseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTripId = searchParams.get('tripId') || '';
  const initialGroupId = searchParams.get('groupId') || '';
  const initialFriendId = searchParams.get('friendId') || '';
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Mode: 'TRIP' | 'GROUP' | 'FRIEND'
  const [splitMode, setSplitMode] = useState<'TRIP' | 'GROUP' | 'FRIEND'>(
    initialTripId ? 'TRIP' : initialGroupId ? 'GROUP' : initialFriendId ? 'FRIEND' : 'TRIP'
  );

  // Common inputs
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [expenseDate, setExpenseDate] = useState(getTodayString);
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [fullAmountSubMode, setFullAmountSubMode] = useState<'EQUAL' | 'PERCENTAGE' | 'CUSTOM'>('EQUAL');
  const [serverError, setServerError] = useState<string | null>(null);

  const setQuickDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setExpenseDate(`${year}-${month}-${day}`);
  };

  // 1-to-1 Friend Mode state
  const [selectedFriendId, setSelectedFriendId] = useState(initialFriendId);

  // Trip Mode state
  const [selectedTripId, setSelectedTripId] = useState(initialTripId);

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

  // 3. Fetch Trips
  const { data: trips, isLoading: tripsLoading } = useQuery<TripItem[]>({
    queryKey: ['trips'],
    queryFn: () => apiFetch<TripItem[]>('/api/trips')
  });

  // Auto-select first friend if available
  useEffect(() => {
    if (friends && friends.length > 0 && !selectedFriendId) {
      setSelectedFriendId(friends[0].friendId);
    }
  }, [friends, selectedFriendId]);

  // Active selected trip / group
  const activeTrip = trips?.find((t) => t.id === selectedTripId) || trips?.[0];
  const activeGroup = groups?.find((g) => g.id === selectedGroupId) || groups?.[0];

  const isCollective = splitMode === 'TRIP' || splitMode === 'GROUP';
  const activeCollective = splitMode === 'TRIP' ? activeTrip : activeGroup;
  const collectiveMembers = (activeCollective?.members || []).map((m: any) => ({
    userId: m.userId,
    user: m.user
  }));

  // Sync collective selected members
  useEffect(() => {
    if (splitMode === 'TRIP' && activeTrip) {
      if (!selectedTripId) setSelectedTripId(activeTrip.id);
      if (!paidBy && user) setPaidBy(user.id);
      const initialSelected: Record<string, boolean> = {};
      (activeTrip.members || []).forEach((m) => {
        initialSelected[m.userId] = true;
      });
      setSelectedMembers(initialSelected);
    } else if (splitMode === 'GROUP' && activeGroup) {
      if (!selectedGroupId) setSelectedGroupId(activeGroup.id);
      if (!paidBy && user) setPaidBy(user.id);
      const initialSelected: Record<string, boolean> = {};
      (activeGroup.members || []).forEach((m) => {
        initialSelected[m.userId] = true;
      });
      setSelectedMembers(initialSelected);
    }
  }, [splitMode, activeTrip, activeGroup, paidBy, user, selectedTripId, selectedGroupId]);

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
      : collectiveMembers.find((m) => m.userId === effectivePayerId)?.user?.name || 'Member';

  // In Full Amount collective mode, adjust selection so payer is not in debtors by default
  useEffect(() => {
    if (splitType === 'FULL_AMOUNT' && isCollective && activeCollective) {
      setSelectedMembers((prev) => {
        const next = { ...prev };
        if (effectivePayerId) {
          next[effectivePayerId] = false;
        }
        const otherMembers = collectiveMembers.filter((m) => m.userId !== effectivePayerId);
        const anySelected = otherMembers.some((m) => next[m.userId]);
        if (!anySelected) {
          otherMembers.forEach((m) => {
            next[m.userId] = true;
          });
        }
        return next;
      });
    }
  }, [splitType, isCollective, activeCollective, effectivePayerId]);

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
      } else if (isCollective && activeCollective) {
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
  }, [totalAmountMinor, splitMode, isCollective, activeFriend, user, activeCollective, selectedMembers, splitType, effectivePayerId]);

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
  } else if (isCollective && activeCollective && totalAmountMinor > 0) {
    const activeParticipantIds = Object.keys(selectedMembers).filter((id) => selectedMembers[id]);

    if (splitType === 'FULL_AMOUNT') {
      const owedMemberIds = activeParticipantIds.filter((id) => id !== effectivePayerId);

      if (owedMemberIds.length === 0) {
        validationError = `Please select at least one person who owes this expense to ${payerName}.`;
      } else if (owedMemberIds.length === 1) {
        const singleDebtorId = owedMemberIds[0];
        const member = collectiveMembers.find((m) => m.userId === singleDebtorId);
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
            const member = collectiveMembers.find((m) => m.userId === id);
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
            const member = collectiveMembers.find((m) => m.userId === id);
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
            const member = collectiveMembers.find((m) => m.userId === id);
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

          calculatedSplits = [
            { userId: effectivePayerId, name: payerName, amountOwed: 0, pct: 0 },
            ...debtorSplits
          ];

          if (Math.abs(sumPct - 100) > 0.01) {
            validationError = `Percentages sum to ${sumPct.toFixed(1)}% (must equal 100%)`;
          }
        }
      }
    } else {
      if (activeParticipantIds.length === 0) {
        validationError = 'Please select at least one member to share this expense.';
      } else if (splitType === 'EQUAL') {
        const count = activeParticipantIds.length;
        const base = Math.floor(totalAmountMinor / count);
        const remainder = totalAmountMinor % count;

        calculatedSplits = activeParticipantIds.map((id, index) => {
          const member = collectiveMembers.find((m) => m.userId === id);
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
          const member = collectiveMembers.find((m) => m.userId === id);
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
          const member = collectiveMembers.find((m) => m.userId === id);
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

  // Mutation
  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip', selectedTripId || activeTrip?.id] });
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', selectedTripId || activeTrip?.id] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', selectedTripId || activeTrip?.id] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-details'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['group-balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });

      if (splitMode === 'TRIP' && (selectedTripId || activeTrip?.id)) {
        router.push(`/trips/${selectedTripId || activeTrip?.id}`);
      } else if (splitMode === 'GROUP' && selectedGroupId) {
        router.push(`/groups/${selectedGroupId}`);
      } else if (splitMode === 'FRIEND' && selectedFriendId) {
        router.push(`/friends/${selectedFriendId}`);
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

    const selectedDateObj = expenseDate ? new Date(`${expenseDate}T12:00:00`) : new Date();

    const payload = {
      groupId: splitMode === 'GROUP' ? selectedGroupId : null,
      tripId: splitMode === 'TRIP' ? (selectedTripId || activeTrip?.id || null) : null,
      description: description.trim(),
      totalAmount: totalAmountMinor,
      splitType,
      paidBy: effectivePayerId,
      expenseDate: selectedDateObj.toISOString(),
      splits: calculatedSplits.map((s) => ({
        userId: s.userId,
        amountOwed: s.amountOwed,
        percentage: splitType === 'PERCENTAGE' ? s.pct : undefined
      }))
    };

    setServerError(null);
    createExpenseMutation.mutate(payload);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 pt-5 pb-12">
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

      {/* Target Selector: Trip, Group, or 1-to-1 Friend */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => setSplitMode('TRIP')}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            splitMode === 'TRIP'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Compass className="w-4 h-4 text-emerald-500" />
          <span>Trip</span>
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
          <span>Group</span>
        </button>
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
          <span>1-on-1 Friend</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Recipient / Space Choice */}
        {splitMode === 'TRIP' ? (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Choose Trip
            </label>
            {tripsLoading ? (
              <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
            ) : !trips || trips.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-center">
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mb-2">No active trips yet.</p>
                <Link
                  href="/trips"
                  className="inline-block px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
                >
                  Create a Trip
                </Link>
              </div>
            ) : (
              <select
                value={selectedTripId || activeTrip?.id}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    🌴 {t.name} ({t.inviteCode}) — {t.members?.length || 1} members
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : splitMode === 'GROUP' ? (
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
        ) : (
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
            placeholder="e.g. Hotel, Dinner, Cab, Tickets, Groceries"
            required
            className="w-full px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* Amount & Expense Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expense Date
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    expenseDate === getTodayString()
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 transition-colors"
                >
                  Yesterday
                </button>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
              />
            </div>
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
              {collectiveMembers.map((m) => (
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
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-xs">{label}</div>
                <div className="text-[9px] text-slate-400 font-normal">{hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 1. FRIEND MODE - EQUAL */}
        {splitMode === 'FRIEND' && activeFriend && user && splitType === 'EQUAL' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Your Share (50%)</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatMinorCurrency(calculatedSplits.find((s) => s.userId === user.id)?.amountOwed || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {activeFriend.friend.name}&apos;s Share (50%)
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatMinorCurrency(calculatedSplits.find((s) => s.userId === activeFriend.friendId)?.amountOwed || 0)}
              </span>
            </div>
          </div>
        )}

        {/* 2. FRIEND MODE - CUSTOM / EXACT */}
        {splitMode === 'FRIEND' && activeFriend && user && splitType === 'EXACT' && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Custom Exact Amounts (₹)
              </label>
              <span className="text-[11px] text-slate-500">
                Total: {formatMinorCurrency(totalAmountMinor || 0)}
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

        {/* 4. COLLECTIVE (TRIP / GROUP) MODE - FULL AMOUNT (Section 10 & 11) */}
        {isCollective && activeCollective && splitType === 'FULL_AMOUNT' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Full Amount: Paid for someone else
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                {payerName} paid the entire {formatMinorCurrency(totalAmountMinor || 0)}. Select the member who owes this expense below.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Who owes this bill to {payerName}?
              </label>
              <div className="space-y-2">
                {collectiveMembers
                  .filter((m) => m.userId !== effectivePayerId)
                  .map((m) => {
                    const isSelected = !!selectedMembers[m.userId];
                    const splitResult = calculatedSplits.find((s) => s.userId === m.userId);

                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              setSelectedMembers((prev) => ({
                                ...prev,
                                [m.userId]: e.target.checked
                              }))
                            }
                            className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 accent-emerald-500 shrink-0"
                          />
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                            {m.user.name} {m.userId === user?.id && '(You)'}
                          </span>
                        </label>

                        {isSelected && (
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {splitResult ? `${m.user.name} owes ${formatMinorCurrency(splitResult.amountOwed)}` : '₹0'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* 5. COLLECTIVE (TRIP / GROUP) MODE - EQUAL / CUSTOM / PERCENTAGE */}
        {isCollective && activeCollective && splitType !== 'FULL_AMOUNT' && (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Who is this expense for?
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    collectiveMembers.forEach((m) => {
                      all[m.userId] = true;
                    });
                    setSelectedMembers(all);
                  }}
                  className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedMembers({})}
                  className="text-[11px] font-medium text-slate-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {collectiveMembers.map((m) => {
                const isSelected = !!selectedMembers[m.userId];
                const splitResult = calculatedSplits.find((s) => s.userId === m.userId);

                return (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          setSelectedMembers((prev) => ({
                            ...prev,
                            [m.userId]: e.target.checked
                          }))
                        }
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 accent-emerald-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                          {m.user.name} {m.userId === user?.id && '(You)'}
                        </span>
                        {splitType === 'PERCENTAGE' && isSelected && (
                          <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                            → {splitResult ? formatMinorCurrency(splitResult.amountOwed) : '₹0'}
                          </span>
                        )}
                      </div>
                    </label>

                    {isSelected && (
                      <div className="w-28 sm:w-32 text-right shrink-0">
                        {splitType === 'EQUAL' && (
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {splitResult ? formatMinorCurrency(splitResult.amountOwed) : '₹0'}
                          </span>
                        )}

                        {splitType === 'EXACT' && (
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
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
                              className="w-full pl-6 pr-2 py-1 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                              className="w-full pr-6 pl-2 py-1 text-xs text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

        {/* Validation Errors */}
        {validationError && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs font-medium rounded-xl border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Financial Summary Card */}
        {totalAmountMinor > 0 && !validationError && (
          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Your Net Balance Change
              </span>
              <span className="text-base font-bold">
                {userNetBalance > 0 ? (
                  <span className="text-emerald-400">+{formatMinorCurrency(userNetBalance)} (You will get back)</span>
                ) : userNetBalance < 0 ? (
                  <span className="text-rose-400">-{formatMinorCurrency(Math.abs(userNetBalance))} (You will owe)</span>
                ) : (
                  <span className="text-slate-300">₹0.00 (Even)</span>
                )}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Your Share</span>
              <span className="text-sm font-semibold">{formatMinorCurrency(myShare)}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={createExpenseMutation.isPending || totalAmountMinor <= 0 || !!validationError}
          className="w-full py-3.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {createExpenseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Save Expense</span>
        </button>
      </form>
    </div>
  );
}

export default function NewExpensePage() {
  return (
    <AppShell showNav={false}>
      <Suspense fallback={<div className="p-6 text-center text-xs text-slate-400">Loading expense form...</div>}>
        <AddExpenseForm />
      </Suspense>
    </AppShell>
  );
}
