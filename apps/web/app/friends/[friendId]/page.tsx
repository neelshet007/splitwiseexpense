'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { FriendRelationshipDetails, FriendRelationshipExpenseItem, SettlementItem } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Receipt,
  Download,
  MoreVertical,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Loader2,
  AlertCircle,
  Users,
  User,
  ChevronDown,
  Clock,
  Sparkles
} from 'lucide-react';

export default function FriendDetailPage() {
  const params = useParams();
  const router = useRouter();
  const friendId = params.friendId as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [dateRange, setDateRange] = useState<'all' | 'this_month' | 'last_month' | 'last_3_months'>('all');
  const [filterType, setFilterType] = useState<'all' | 'you_paid' | 'friend_paid' | 'you_owe' | 'friend_owes'>('all');
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmountStr, setSettleAmountStr] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch Friend Relationship Details
  const {
    data: details,
    isLoading,
    error
  } = useQuery<FriendRelationshipDetails>({
    queryKey: ['friend-details', friendId, dateRange],
    queryFn: () =>
      apiFetch<FriendRelationshipDetails>(
        `/api/friends/${friendId}?range=${dateRange}`
      ),
    enabled: !!friendId
  });

  // Open Settle Modal initialized with full net balance
  const openSettleModal = () => {
    if (!details) return;
    const defaultAmountRupees = (Math.abs(details.netBalance) / 100).toFixed(2);
    setSettleAmountStr(defaultAmountRupees === '0.00' ? '' : defaultAmountRupees);
    setSettleNote('');
    setSettleError(null);
    setIsSettleModalOpen(true);
  };

  // Settle Up Mutation
  const settleMutation = useMutation({
    mutationFn: (payload: { amount?: number; note?: string }) =>
      apiFetch(`/api/friends/${friendId}/settle`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-details', friendId] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsSettleModalOpen(false);
    },
    onError: (err: any) => {
      setSettleError(err.message || 'Failed to record settlement.');
    }
  });

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError(null);

    const amountNum = parseFloat(settleAmountStr);
    const amountMinor = isNaN(amountNum) || amountNum <= 0 ? undefined : Math.round(amountNum * 100);

    settleMutation.mutate({
      amount: amountMinor,
      note: settleNote.trim() || undefined
    });
  };

  // Excel Export Handler (Downloads valid .xlsx workbook from backend)
  const handleExportExcel = async (selectedRange = dateRange) => {
    try {
      setIsExporting(true);
      setMobileMenuOpen(false);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const response = await fetch(`${API_URL}/api/friends/${friendId}/export?range=${selectedRange}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to generate Excel export.');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `friend-${details?.friend.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'export'}-expenses.xlsx`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (!details?.expenses) return [];

    return details.expenses.filter((exp) => {
      if (filterType === 'all') return true;
      if (filterType === 'you_paid') return exp.paidBy === user?.id;
      if (filterType === 'friend_paid') return exp.paidBy === friendId;
      if (filterType === 'you_owe') return exp.userNet < 0;
      if (filterType === 'friend_owes') return exp.userNet > 0;
      return true;
    });
  }, [details?.expenses, filterType, user?.id, friendId]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        </div>
      </AppShell>
    );
  }

  if (error || !details) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Friend Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
            This relationship does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/friends"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-emerald-500 text-white text-xs font-bold rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Friends</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const friend = details.friend;
  const netBalance = details.netBalance;
  const friendOwesYou = netBalance > 0;
  const youOweFriend = netBalance < 0;
  const isSettled = netBalance === 0;

  return (
    <AppShell>
      <div className="px-4 sm:px-5 pt-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/friends"
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Back to friends"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-emerald-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                {friend.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {friend.name}
                </h1>
                <p className="text-[11px] text-slate-400">{friend.email}</p>
              </div>
            </div>
          </div>

          {/* Desktop & Mobile Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop Export Button */}
            <button
              onClick={() => handleExportExcel(dateRange)}
              disabled={isExporting}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export Excel</span>
            </button>

            {/* Mobile More Menu */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {mobileMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-30 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => handleExportExcel(dateRange)}
                    disabled={isExporting}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl transition-colors"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    ) : (
                      <Download className="w-4 h-4 text-emerald-500" />
                    )}
                    <span>Export to Excel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. Primary Relationship Balance Card (Section 3) */}
        <div
          className={`relative overflow-hidden p-6 rounded-3xl mb-5 border transition-all ${
            friendOwesYou
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-50'
              : youOweFriend
              ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/40 text-rose-950 dark:text-rose-50'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 text-slate-900 dark:text-white'
          }`}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  friendOwesYou
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : youOweFriend
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {friendOwesYou
                  ? `${friend.name} owes you`
                  : youOweFriend
                  ? `You owe ${friend.name}`
                  : `You and ${friend.name} are settled up`}
              </span>

              {isSettled && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Settled</span>
                </div>
              )}
            </div>

            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight my-2">
              {isSettled
                ? '₹0'
                : formatMinorCurrency(Math.abs(netBalance))}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {friendOwesYou
                ? `${friend.name} owes you this balance across all direct and shared expenses.`
                : youOweFriend
                ? `You owe ${friend.name} this amount from your shared expenses.`
                : 'All shared bills and settlements between you two are fully balanced.'}
            </p>

            {/* Action Buttons: Add Expense & Settle Up */}
            <div className="flex items-center gap-2.5 mt-5">
              <Link
                href={`/expenses/new?friendId=${friendId}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-sm hover:opacity-95 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Expense</span>
              </Link>

              <button
                onClick={openSettleModal}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-2xl text-xs font-bold transition-all active:scale-95 border ${
                  friendOwesYou
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                    : youOweFriend
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-transparent'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Settle Up</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Relationship Statistics (Section 4) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Relationship Statistics
            </h2>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{dateRange === 'all' ? 'All Time' : dateRange.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Expenses</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {formatMinorCurrency(details.totalExpenses)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">You Paid</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {formatMinorCurrency(details.totalPaidByUser)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">{friend.name} Paid</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {formatMinorCurrency(details.totalPaidByFriend)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Your Share</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {formatMinorCurrency(details.userShare)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">{friend.name}&apos;s Share</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {formatMinorCurrency(details.friendShare)}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Settlements</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {details.settlements.length} recorded
              </p>
            </div>
          </div>
        </div>

        {/* 3. Expense Filters & Date Range (Section 6) */}
        <div className="mb-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Expense History
            </h2>

            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All time</option>
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="last_3_months">Last 3 months</option>
            </select>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {[
              { id: 'all', label: `All (${details.expenses.length})` },
              { id: 'you_paid', label: 'You paid' },
              { id: 'friend_paid', label: `${friend.name} paid` },
              { id: 'you_owe', label: 'You owe' },
              { id: 'friend_owes', label: `${friend.name} owes` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  filterType === tab.id
                    ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm'
                    : 'bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Chronological Expense List (Section 5) */}
        {filteredExpenses.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center mb-6">
            <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No expenses found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              {filterType === 'all'
                ? `You and ${friend.name} have no shared expenses for this period.`
                : 'No expenses matching this filter.'}
            </p>
            <Link
              href={`/expenses/new?friendId=${friendId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-sm hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add an Expense with {friend.name}</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 mb-6">
            {filteredExpenses.map((exp) => {
              const expDateStr = new Date(exp.expenseDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });
              const youPaid = exp.paidBy === user?.id;

              return (
                <div
                  key={exp.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 hover:border-slate-300 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-sm border border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
                      <Receipt className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {exp.description}
                        </h3>
                        {exp.groupName ? (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            <span>{exp.groupName}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            Direct
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-300">
                          <Calendar className="w-3 h-3 text-emerald-500" />
                          <span>{expDateStr}</span>
                        </span>
                        <span>•</span>
                        <span>{youPaid ? 'You paid' : `${friend.name} paid`}</span>
                        <span>•</span>
                        <span>Total {formatMinorCurrency(exp.totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Relationship impact column */}
                  <div className="text-right">
                    {exp.userNet > 0 ? (
                      <div>
                        <span className="text-[10px] block font-semibold text-slate-400">
                          {friend.name} owes you
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatMinorCurrency(exp.userNet)}
                        </span>
                      </div>
                    ) : exp.userNet < 0 ? (
                      <div>
                        <span className="text-[10px] block font-semibold text-slate-400">
                          You owe {friend.name}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                          {formatMinorCurrency(Math.abs(exp.userNet))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Settled in bill</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Settlement History (Section 9) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Settlement History</span>
            </h2>
            <span className="text-[11px] text-slate-400">{details.settlements.length} total</span>
          </div>

          {details.settlements.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No past settlements recorded between you and {friend.name} yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {details.settlements.map((s) => {
                const sDate = new Date(s.settledAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                const youPaid = s.fromUserId === user?.id;

                return (
                  <div
                    key={s.id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {youPaid ? `You paid ${friend.name}` : `${friend.name} paid you`}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {sDate} {s.note ? `• ${s.note}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatMinorCurrency(s.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Settle Up Modal (Section 8) */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Settle Up</h3>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Guidance */}
            <div
              className={`p-3.5 rounded-2xl text-xs mb-4 border ${
                friendOwesYou
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40'
                  : youOweFriend
                  ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40'
                  : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              <p className="font-bold">
                {friendOwesYou
                  ? `${friend.name} owes you ${formatMinorCurrency(netBalance)}`
                  : youOweFriend
                  ? `You owe ${friend.name} ${formatMinorCurrency(Math.abs(netBalance))}`
                  : `You and ${friend.name} are currently settled up`}
              </p>
              <p className="text-[11px] mt-0.5 opacity-90">
                Settlements are recorded permanently without modifying or deleting past expenses.
              </p>
            </div>

            {settleError && (
              <div className="mb-4 p-3 rounded-xl text-xs bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{settleError}</span>
              </div>
            )}

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Amount to Settle (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={settleAmountStr}
                    onChange={(e) => setSettleAmountStr(e.target.value)}
                    placeholder="e.g. 1240"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="e.g. Paid via UPI / Cash"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleMutation.isPending || !settleAmountStr}
                  className="flex-1 py-3 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {settleMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Mark Settled</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
