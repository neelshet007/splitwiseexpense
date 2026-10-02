'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DashboardSummary } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency, formatDate } from '@/lib/utils';
import { ArrowUpRight, ArrowDownLeft, Receipt } from 'lucide-react';

export default function ActivityPage() {
  const { user } = useAuth();

  const { data: summary, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiFetch<DashboardSummary>('/api/dashboard/summary'),
    enabled: !!user
  });

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Activity Log</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">All expenses logged across your groups</p>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load activity</div>
        ) : summary?.recentExpenses.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No expense activity yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {summary?.recentExpenses.map((expense) => {
              const isPayer = expense.paidBy === user?.id;
              const userSplit = expense.splits.find((s) => s.userId === user?.id);
              const userShare = userSplit ? userSplit.amountOwed : 0;

              return (
                <Link
                  key={expense.id}
                  href={`/expenses/${expense.id}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-slate-200 transition-all active:scale-[0.99]"
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
    </AppShell>
  );
}
