'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { DashboardSummary } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency, formatDate } from '@/lib/utils';
import { ArrowUpRight, ArrowDownLeft, ChevronRight, Receipt, PlusCircle, Users } from 'lucide-react';

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  let timeStr = 'Good morning';
  if (hour >= 12 && hour < 17) timeStr = 'Good afternoon';
  else if (hour >= 17) timeStr = 'Good evening';

  return `${timeStr}, ${name.split(' ')[0]} 👋`;
}

function getCurrentMonthName(): string {
  return new Date().toLocaleString('en-US', { month: 'long' });
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const { data: summary, isLoading, error, refetch } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiFetch<DashboardSummary>('/api/dashboard/summary'),
    enabled: !!user
  });

  if (authLoading || isLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-6 animate-pulse">
          <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          </div>
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
      </AppShell>
    );
  }

  if (error || !summary) {
    return (
      <AppShell>
        <div className="p-6 text-center py-20">
          <p className="text-sm text-red-500 mb-4">Failed to load dashboard summary</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium"
          >
            Try Again
          </button>
        </div>
      </AppShell>
    );
  }

  const currentMonth = getCurrentMonthName();

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        {/* Header Greeting */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {getGreeting(summary.user.name)}
            </h1>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
              {currentMonth} Overview
            </p>
          </div>
          <Link
            href="/settings"
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 hover:scale-105 transition-transform"
          >
            {summary.user.name.charAt(0)}
          </Link>
        </div>

        {/* Financial Net Card */}
        <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-950/10 mb-6">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
            <span>Overall Balance</span>
            <span>{currentMonth}</span>
          </div>

          <div className="text-3xl font-bold tracking-tight mb-5">
            {summary.netBalance >= 0 ? (
              <span className="text-emerald-400">+{formatMinorCurrency(summary.netBalance)}</span>
            ) : (
              <span className="text-rose-400">-{formatMinorCurrency(Math.abs(summary.netBalance))}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">You paid</p>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">
                {formatMinorCurrency(summary.totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">You owe</p>
              <p className="text-sm font-semibold text-rose-400 mt-0.5">
                {formatMinorCurrency(summary.totalYouOwe)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">You are owed</p>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5">
                {formatMinorCurrency(summary.totalOwedToYou)}
              </p>
            </div>
          </div>
        </div>

        {/* Active Groups Preview */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-500" />
              <span>Your Groups</span>
            </h2>
            <Link
              href="/groups"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center"
            >
              <span>See all ({summary.groups.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {summary.groups.length === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                No active groups yet. Create a group to start sharing expenses!
              </p>
              <Link
                href="/groups"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 text-white rounded-xl text-xs font-medium shadow-sm hover:bg-emerald-600 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Group</span>
              </Link>
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {summary.groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="flex-shrink-0 w-36 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 hover:border-emerald-500/50 transition-all active:scale-95"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs mb-2">
                    {group.name.charAt(0)}
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {group.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {group.members.length} members
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses Feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-500" />
              <span>Recent Activity</span>
            </h2>
            <Link
              href="/activity"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {summary.recentExpenses.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No recent expenses recorded.</p>
              <p className="mt-1">Tap the + button below to log an expense.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {summary.recentExpenses.map((expense) => {
                const isPayer = expense.paidBy === summary.user.id;
                const userSplit = expense.splits.find((s) => s.userId === summary.user.id);
                const userShare = userSplit ? userSplit.amountOwed : 0;

                return (
                  <Link
                    key={expense.id}
                    href={`/expenses/${expense.id}`}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-sm">
                        {isPayer ? (
                          <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[170px]">
                          {expense.description}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isPayer ? 'You paid' : `${expense.payer.name.split(' ')[0]} paid`}{' '}
                          {formatMinorCurrency(expense.totalAmount)} • {formatDate(expense.expenseDate)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {isPayer ? (
                        <div>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            +{formatMinorCurrency(expense.totalAmount - userShare)}
                          </p>
                          <p className="text-[10px] text-slate-400">owed to you</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            -{formatMinorCurrency(userShare)}
                          </p>
                          <p className="text-[10px] text-slate-400">your share</p>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
