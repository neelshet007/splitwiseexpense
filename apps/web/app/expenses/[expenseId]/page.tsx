'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ExpenseItem } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Trash2, Calendar, User, Users, AlertCircle, Loader2 } from 'lucide-react';

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const expenseId = params.expenseId as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: expense, isLoading, error } = useQuery<ExpenseItem>({
    queryKey: ['expense', expenseId],
    queryFn: () => apiFetch<ExpenseItem>(`/api/expenses/${expenseId}`)
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/expenses/${expenseId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['group-balances'] });
      queryClient.invalidateQueries({ queryKey: ['group-settlements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (expense?.groupId) {
        router.push(`/groups/${expense.groupId}`);
      } else {
        router.push('/dashboard');
      }
    },
    onError: (err: any) => {
      setDeleteError(err.message || 'Failed to delete expense');
    }
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-6 w-1/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        </div>
      </AppShell>
    );
  }

  if (error || !expense) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-red-500">Expense not found or access denied.</div>
      </AppShell>
    );
  }

  const isPayer = expense.paidBy === user?.id;
  const mySplit = expense.splits.find((s) => s.userId === user?.id);
  const myShare = mySplit ? mySplit.amountOwed : 0;
  const canDelete = isPayer || expense.createdBy === user?.id;

  return (
    <AppShell>
      <div className="px-5 pt-6 pb-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href={`/groups/${expense.groupId}`}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {canDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this expense?')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
              title="Delete expense"
            >
              {deleteMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            </button>
          )}
        </div>

        {deleteError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}

        {/* Expense Total Card */}
        <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-950/10 mb-6">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
            {expense.splitType} SPLIT
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">{expense.description}</h1>
          <div className="text-3xl font-extrabold text-white mb-6">
            {formatMinorCurrency(expense.totalAmount)}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <User className="w-4 h-4 text-emerald-400" />
              <span>
                Paid by <b className="text-white">{isPayer ? 'You' : expense.payer.name}</b>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(expense.expenseDate)}</span>
            </div>
          </div>
        </div>

        {/* Your Perspective Breakdown */}
        <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Your Balance Breakdown
          </h2>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
              <p className="text-[11px] text-slate-400">You paid</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {isPayer ? formatMinorCurrency(expense.totalAmount) : '₹0'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
              <p className="text-[11px] text-slate-400">Your share</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {formatMinorCurrency(myShare)}
              </p>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 text-center">
            {isPayer ? (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                You are owed {formatMinorCurrency(expense.totalAmount - myShare)}
              </p>
            ) : myShare > 0 ? (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                You owe {formatMinorCurrency(myShare)} to {expense.payer.name.split(' ')[0]}
              </p>
            ) : (
              <p className="text-xs text-slate-400 font-medium">You were not part of this split</p>
            )}
          </div>
        </div>

        {/* Participants Split List */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>Participants ({expense.splits.length})</span>
          </h2>

          <div className="space-y-2">
            {expense.splits.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center">
                    {s.user?.name.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {s.user?.name} {s.userId === user?.id && '(You)'}
                    </p>
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {formatMinorCurrency(s.amountOwed)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
