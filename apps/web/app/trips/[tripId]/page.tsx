'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  TripItem,
  TripBalancesResponse,
  TripSettlementsResponse,
  ExpenseItem,
  SplitType
} from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Compass,
  Users,
  Copy,
  Check,
  Plus,
  ArrowRight,
  Receipt,
  Download,
  Share2,
  Calendar,
  Trash2,
  Edit2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Shield,
  UserCheck,
  RefreshCw,
  Sliders,
  DollarSign
} from 'lucide-react';

function getCategoryEmoji(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('hotel') || d.includes('stay') || d.includes('resort') || d.includes('room') || d.includes('airbnb')) return '🏨';
  if (d.includes('dinner') || d.includes('lunch') || d.includes('food') || d.includes('meal') || d.includes('pizza') || d.includes('burger') || d.includes('restaurant')) return '🍕';
  if (d.includes('cab') || d.includes('taxi') || d.includes('uber') || d.includes('ola') || d.includes('fuel') || d.includes('petrol') || d.includes('toll')) return '🚕';
  if (d.includes('flight') || d.includes('plane') || d.includes('airport')) return '✈️';
  if (d.includes('ticket') || d.includes('entry') || d.includes('pass') || d.includes('movie')) return '🎟️';
  if (d.includes('coffee') || d.includes('tea') || d.includes('cafe') || d.includes('starbucks')) return '☕';
  if (d.includes('drink') || d.includes('beer') || d.includes('alcohol') || d.includes('bar') || d.includes('club')) return '🍻';
  if (d.includes('grocer') || d.includes('supermarket') || d.includes('mart') || d.includes('snack')) return '🛒';
  return '💸';
}

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Active Tab: 'EXPENSES' | 'BALANCES' | 'SETTINGS'
  const [activeTab, setActiveTab] = useState<'EXPENSES' | 'BALANCES' | 'SETTINGS'>('EXPENSES');

  // Modals state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);

  // Copied invite feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Settle modal initial values
  const [settlePayerId, setSettlePayerId] = useState('');
  const [settleReceiverId, setSettleReceiverId] = useState('');
  const [settleAmountStr, setSettleAmountStr] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);

  // Add Member state
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string | null>(null);

  // 1. Fetch Trip details
  const { data: trip, isLoading: tripLoading } = useQuery<TripItem>({
    queryKey: ['trip', tripId],
    queryFn: () => apiFetch<TripItem>(`/api/trips/${tripId}`),
    enabled: !!tripId
  });

  // 2. Fetch Trip Balances
  const { data: balances, isLoading: balancesLoading } = useQuery<TripBalancesResponse>({
    queryKey: ['trip-balances', tripId],
    queryFn: () => apiFetch<TripBalancesResponse>(`/api/trips/${tripId}/balances`),
    enabled: !!tripId
  });

  // 3. Fetch Trip Settlements
  const { data: settlementsData, isLoading: settlementsLoading } = useQuery<TripSettlementsResponse>({
    queryKey: ['trip-settlements', tripId],
    queryFn: () => apiFetch<TripSettlementsResponse>(`/api/trips/${tripId}/settlements`),
    enabled: !!tripId
  });

  // 4. Fetch Trip Expenses
  const { data: expenses, isLoading: expensesLoading } = useQuery<ExpenseItem[]>({
    queryKey: ['trip-expenses', tripId],
    queryFn: () => apiFetch<ExpenseItem[]>(`/api/trips/${tripId}/expenses`),
    enabled: !!tripId
  });

  // Member permissions
  const isCreator = trip?.createdBy === user?.id;
  const currentMember = trip?.members.find((m) => m.userId === user?.id);
  const isAdmin = isCreator || currentMember?.role === 'ADMIN';

  // -------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------
  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) =>
      apiFetch(`/api/expenses/${expenseId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-settlements', tripId] });
      setSelectedExpense(null);
    }
  });

  const recordSettlementMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch(`/api/trips/${tripId}/settlements`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-settlements', tripId] });
      setShowSettleModal(false);
      setSettleAmountStr('');
      setSettleNote('');
      setSettleError(null);
    },
    onError: (err: any) => {
      setSettleError(err.message || 'Failed to record settlement');
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: (email: string) =>
      apiFetch(`/api/trips/${tripId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
      setAddMemberEmail('');
      setAddMemberSuccess('Member added to trip!');
      setTimeout(() => setAddMemberSuccess(null), 3000);
    },
    onError: (err: any) => {
      setAddMemberError(err.message || 'Failed to add member');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/trips/${tripId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to remove member');
    }
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ inviteCode: string }>(`/api/trips/${tripId}/invite/regenerate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    }
  });

  const handleCopyCode = () => {
    if (!trip?.inviteCode) return;
    navigator.clipboard.writeText(trip.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!trip?.inviteCode) return;
    const url = `${window.location.origin}/invite/trip/${trip.inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = async () => {
    if (!trip?.inviteCode) return;
    const shareData = {
      title: `${trip.name} on Splitwise`,
      text: `Join our trip "${trip.name}" to track and split expenses! Use code: ${trip.inviteCode}`,
      url: `${window.location.origin}/invite/trip/${trip.inviteCode}`
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleExportExcel = () => {
    window.open(`/api/trips/${tripId}/export`, '_blank');
  };

  const openSettleWithUser = (debtorId: string, creditorId: string, amountPaise: number) => {
    setSettlePayerId(debtorId);
    setSettleReceiverId(creditorId);
    setSettleAmountStr((amountPaise / 100).toFixed(2));
    setSettleNote('');
    setSettleError(null);
    setShowSettleModal(true);
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(settleAmountStr);
    if (!amountVal || amountVal <= 0) {
      setSettleError('Please enter a valid positive amount.');
      return;
    }
    if (!settlePayerId || !settleReceiverId) {
      setSettleError('Both payer and receiver are required.');
      return;
    }

    recordSettlementMutation.mutate({
      fromUserId: settlePayerId,
      toUserId: settleReceiverId,
      amount: Math.round(amountVal * 100),
      note: settleNote.trim() || undefined
    });
  };

  if (tripLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (!trip) {
    return (
      <AppShell>
        <div className="p-8 text-center py-20">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Trip Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">This trip may have been removed or you may not be a member.</p>
          <Link href="/trips" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold">
            Back to Trips
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 pt-6 pb-28">
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/trips"
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              title="Export Trip Ledger to Excel"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors text-slate-700 dark:text-slate-300 flex items-center gap-1 text-xs font-medium"
            >
              <Users className="w-4 h-4" />
              <span>Invite</span>
            </button>
          </div>
        </div>

        {/* Trip Title & Code Card */}
        <div className="mb-5 p-5 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-950/15 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-[11px] font-mono text-emerald-400 font-semibold mb-2">
                <span>Trip ID: {trip.inviteCode}</span>
                <button onClick={handleCopyCode} className="ml-1 hover:text-white transition-colors" title="Copy Code">
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>{trip.name}</span>
                <span className="text-lg">🌴</span>
              </h1>
              {trip.description && (
                <p className="text-xs text-slate-400 mt-1 max-w-sm">{trip.description}</p>
              )}
            </div>

            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Share Trip"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* User Net Balance Badge */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Your Balance</p>
              <div className="text-lg font-bold mt-0.5">
                {balances && balances.netBalance > 0 ? (
                  <span className="text-emerald-400">You are owed {formatMinorCurrency(balances.netBalance)}</span>
                ) : balances && balances.netBalance < 0 ? (
                  <span className="text-rose-400">You owe {formatMinorCurrency(Math.abs(balances.netBalance))}</span>
                ) : (
                  <span className="text-slate-300">All settled up</span>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Total Expenses</p>
              <p className="text-lg font-bold text-white">
                {balances ? formatMinorCurrency(balances.totalExpenses) : '₹0.00'}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Quick Stat Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">Total Paid</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {balances ? formatMinorCurrency(balances.youPaid) : '₹0.00'}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">Your Share</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {balances ? formatMinorCurrency(balances.yourShare) : '₹0.00'}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">You are owed</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {balances ? formatMinorCurrency(balances.youAreOwed) : '₹0.00'}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">You owe</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
              {balances ? formatMinorCurrency(balances.youOwe) : '₹0.00'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 mb-6">
          <Link
            href={`/expenses/new?tripId=${tripId}`}
            className="flex-1 py-3 px-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Trip Expense</span>
          </Link>
          <button
            onClick={() => {
              setSettlePayerId(user?.id || '');
              setSettleReceiverId('');
              setSettleAmountStr('');
              setShowSettleModal(true);
            }}
            className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-900 dark:text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span>Settle Up</span>
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 mb-5">
          <button
            onClick={() => setActiveTab('EXPENSES')}
            className={`pb-3 text-xs font-bold transition-colors relative flex items-center gap-1.5 mr-6 ${
              activeTab === 'EXPENSES'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Expenses ({expenses?.length || 0})</span>
            {activeTab === 'EXPENSES' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-emerald-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('BALANCES')}
            className={`pb-3 text-xs font-bold transition-colors relative flex items-center gap-1.5 mr-6 ${
              activeTab === 'BALANCES'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Balances & Debt</span>
            {activeTab === 'BALANCES' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-emerald-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`pb-3 text-xs font-bold transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'SETTINGS'
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Settings ({trip.members.length} members)</span>
            {activeTab === 'SETTINGS' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>

        {/* TAB 1: EXPENSES LIST */}
        {activeTab === 'EXPENSES' && (
          <div>
            {expensesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : !expenses || expenses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No expenses recorded yet</h3>
                <p className="text-xs text-slate-400 mb-4">Add your hotel, food, cab or sightseeing bills</p>
                <Link
                  href={`/expenses/new?tripId=${tripId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Expense</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {expenses.map((exp) => {
                  const emoji = getCategoryEmoji(exp.description);
                  const isPayer = exp.paidBy === user?.id;
                  const isCreator = exp.createdBy === user?.id;
                  const participantCount = exp.splits.length;
                  const mySplit = exp.splits.find((s) => s.userId === user?.id);

                  // Human-readable participant label
                  let forLabel = '';
                  if (exp.splitType === 'FULL_AMOUNT') {
                    const debtor = exp.splits.find((s) => s.amountOwed > 0) || exp.splits[0];
                    forLabel = debtor?.userId === user?.id ? 'For You' : `For ${debtor?.user?.name || 'Member'}`;
                  } else if (participantCount === trip.members.length) {
                    forLabel = 'All members';
                  } else if (participantCount === 2) {
                    const names = exp.splits.map((s) => (s.userId === user?.id ? 'You' : s.user?.name || 'Member'));
                    forLabel = names.join(' + ');
                  } else {
                    forLabel = `${participantCount} members`;
                  }

                  return (
                    <div
                      key={exp.id}
                      onClick={() => setSelectedExpense(exp)}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shrink-0">
                          {emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {exp.description}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {forLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isPayer ? 'You paid' : `${exp.payer.name} paid`} • {formatDate(exp.expenseDate)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {formatMinorCurrency(exp.totalAmount)}
                        </div>
                        {mySplit ? (
                          <div className="text-[10px] text-slate-500 font-medium">
                            Your share: {formatMinorCurrency(mySplit.amountOwed)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">Not involved</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BALANCES & SIMPLIFIED SETTLEMENTS */}
        {activeTab === 'BALANCES' && (
          <div className="space-y-6">
            {/* Section: Simplified Settlements */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Simplified Settlements
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Min cash flow</span>
              </div>

              {!settlementsData || settlementsData.settlements.length === 0 ? (
                <div className="py-4 text-center">
                  <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">All balances are even!</p>
                  <p className="text-[11px] text-slate-400">No pending transfers needed.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {settlementsData.settlements.map((s, idx) => {
                    const isFromMe = s.fromUserId === user?.id;
                    const isToMe = s.toUserId === user?.id;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl flex items-center justify-between border ${
                          isFromMe
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900'
                            : isToMe
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {isFromMe ? 'You' : s.fromUserName}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {isToMe ? 'You' : s.toUserName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {formatMinorCurrency(s.amount)}
                          </span>
                          <button
                            onClick={() => openSettleWithUser(s.fromUserId, s.toUserId, s.amount)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 shadow-xs"
                          >
                            Settle
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section: Members Balances Table */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                Member Breakdown
              </h3>

              <div className="space-y-2">
                {balances?.balances.map((b) => {
                  const isMe = b.userId === user?.id;

                  return (
                    <div
                      key={b.userId}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {b.userName}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Paid: {formatMinorCurrency(b.totalPaid)} • Share: {formatMinorCurrency(b.totalShare)}
                        </p>
                      </div>

                      <div className="text-right">
                        {b.netBalance > 0 ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            +{formatMinorCurrency(b.netBalance)}
                          </span>
                        ) : b.netBalance < 0 ? (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            -{formatMinorCurrency(Math.abs(b.netBalance))}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">₹0.00</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: Recorded Settlements History */}
            {settlementsData && settlementsData.recordedSettlements.length > 0 && (
              <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                  Settlement History
                </h3>
                <div className="space-y-2">
                  {settlementsData.recordedSettlements.map((rs) => (
                    <div key={rs.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {rs.fromUser.name} paid {rs.toUser.name}
                        </span>
                        {rs.note && <p className="text-[10px] text-slate-400 italic">"{rs.note}"</p>}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMinorCurrency(rs.amount)}
                        </span>
                        <p className="text-[10px] text-slate-400">{formatDate(rs.settledAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SETTINGS & MEMBERS */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-6">
            {/* Add Member Box */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-1">
                Add Trip Member
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Search and invite a registered user by email address
              </p>

              {addMemberError && (
                <div className="mb-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{addMemberError}</span>
                </div>
              )}

              {addMemberSuccess && (
                <div className="mb-3 p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{addMemberSuccess}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!addMemberEmail.trim()) return;
                  setAddMemberError(null);
                  addMemberMutation.mutate(addMemberEmail.trim());
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  required
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending || !addMemberEmail.trim()}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {addMemberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </button>
              </form>
            </div>

            {/* Members List */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
                Trip Members ({trip.members.length})
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {trip.members.map((m) => {
                  const isUserAdmin = m.role === 'ADMIN' || m.userId === trip.createdBy;
                  const isCurrent = m.userId === user?.id;

                  return (
                    <div key={m.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                          {m.user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {m.user.name}
                            </span>
                            {isUserAdmin && (
                              <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">{m.user.email}</span>
                        </div>
                      </div>

                      {/* Remove Button (admin can remove others, user can leave if not only admin) */}
                      {(isAdmin || isCurrent) && !isUserAdmin && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${m.user.name} from this trip?`)) {
                              removeMemberMutation.mutate(m.userId);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invite Settings */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-1">
                Trip Invite Code
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Anyone with this code can join the trip
              </p>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 mb-3">
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {trip.inviteCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm('Regenerate invite code? Existing shared links will expire.')) {
                      regenerateCodeMutation.mutate();
                    }
                  }}
                  disabled={regenerateCodeMutation.isPending}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Invite Code</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODAL: EXPENSE DETAILS (Requirement 19) */}
        {selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedExpense(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-2xl">
                  {getCategoryEmoji(selectedExpense.description)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedExpense.description}
                  </h3>
                  <p className="text-xs text-slate-400">{formatDate(selectedExpense.expenseDate)}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 mb-4 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Amount</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatMinorCurrency(selectedExpense.totalAmount)}
                </p>
                <div className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Paid by <span className="font-bold text-slate-900 dark:text-white">{selectedExpense.payer.name}</span>
                </div>
                {selectedExpense.createdBy !== selectedExpense.paidBy && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    (Entered by {selectedExpense.creator.name})
                  </div>
                )}
              </div>

              {/* Splits Breakdown */}
              <div className="mb-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Split Breakdown ({selectedExpense.splitType})
                </h4>
                <div className="space-y-1.5">
                  {selectedExpense.splits.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {s.userId === user?.id ? 'You' : s.user?.name || 'Member'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatMinorCurrency(s.amountOwed)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delete / Actions */}
              {(selectedExpense.createdBy === user?.id || selectedExpense.paidBy === user?.id || isAdmin) && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this expense?')) {
                        deleteExpenseMutation.mutate(selectedExpense.id);
                      }
                    }}
                    disabled={deleteExpenseMutation.isPending}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Expense</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: RECORD SETTLEMENT */}
        {showSettleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
              <button
                onClick={() => setShowSettleModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <span className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Settlement</h3>
                  <p className="text-xs text-slate-400">Mark a payment between trip members</p>
                </div>
              </div>

              {settleError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{settleError}</span>
                </div>
              )}

              <form onSubmit={handleSettleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Who paid?
                  </label>
                  <select
                    value={settlePayerId}
                    onChange={(e) => setSettlePayerId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="">Select payer</option>
                    {trip.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.userId === user?.id ? 'You' : m.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Who was paid?
                  </label>
                  <select
                    value={settleReceiverId}
                    onChange={(e) => setSettleReceiverId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="">Select receiver</option>
                    {trip.members
                      .filter((m) => m.userId !== settlePayerId)
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.userId === user?.id ? 'You' : m.user.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={settleAmountStr}
                    onChange={(e) => setSettleAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                    placeholder="e.g. UPI, Cash, GPay"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettleModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recordSettlementMutation.isPending || !settleAmountStr || !settlePayerId || !settleReceiverId}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {recordSettlementMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Settlement</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: INVITE MEMBERS */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
              <button
                onClick={() => setShowInviteModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <span className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Share2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Invite to {trip.name}</h3>
                  <p className="text-xs text-slate-400">Share with friends on the trip</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trip Code
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80">
                    <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                      {trip.inviteCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Direct Invite Link
                  </label>
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-2.5 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center justify-center gap-2"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Invite Link'}</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleShare}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share Trip with Friends</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
