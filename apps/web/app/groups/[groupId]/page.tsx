'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { GroupItem, ExpenseItem, GroupBalancesResponse, GroupSettlementsResponse } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Users,
  Receipt,
  Scale,
  Send,
  UserPlus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Share2,
  Sparkles
} from 'lucide-react';

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members'>('expenses');
  const [memberEmail, setMemberEmail] = useState('');
  const [addMemberMsg, setAddMemberMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // 1. Group info
  const { data: group, isLoading: groupLoading } = useQuery<GroupItem>({
    queryKey: ['group', groupId],
    queryFn: () => apiFetch<GroupItem>(`/api/groups/${groupId}`)
  });

  // 2. Group expenses
  const { data: expensesData, isLoading: expensesLoading } = useQuery<any>({
    queryKey: ['group-expenses', groupId],
    queryFn: () => apiFetch<any>(`/api/groups/${groupId}/expenses`),
    enabled: activeTab === 'expenses'
  });

  // Safely extract expenses array whether returned as array or { expenses: [] }
  const expensesList: ExpenseItem[] = useMemo(() => {
    if (Array.isArray(expensesData)) return expensesData;
    if (expensesData && Array.isArray(expensesData.expenses)) {
      return expensesData.expenses;
    }
    return [];
  }, [expensesData]);

  // 3. Group balances
  const { data: balancesData } = useQuery<GroupBalancesResponse>({
    queryKey: ['group-balances', groupId],
    queryFn: () => apiFetch<GroupBalancesResponse>(`/api/groups/${groupId}/balances`)
  });

  // 4. Group settlements
  const { data: settlementsData } = useQuery<GroupSettlementsResponse>({
    queryKey: ['group-settlements', groupId],
    queryFn: () => apiFetch<GroupSettlementsResponse>(`/api/groups/${groupId}/settlements`)
  });

  const handleCopyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShareInvite = async (groupName: string, inviteCode: string) => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    const shareData = {
      title: `Join ${groupName} on Splitwise Private`,
      text: `Join our expense group "${groupName}". Use invite code ${inviteCode} or tap the link:`,
      url: inviteUrl
    };

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled share or Web Share API unsupported
      }
    }

    // Fallback: copy invite link to clipboard
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: (email: string) =>
      apiFetch<GroupItem>(`/api/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
      setAddMemberMsg({ type: 'success', text: 'Member added successfully!' });
      setMemberEmail('');
    },
    onError: (err: any) => {
      setAddMemberMsg({ type: 'error', text: err.message || 'Failed to add member' });
    }
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setAddMemberMsg(null);
    addMemberMutation.mutate(memberEmail);
  };

  if (groupLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-4 animate-pulse">
          <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-red-500">Group not found or access denied.</div>
      </AppShell>
    );
  }

  // Calculate current user's balance in this group
  const currentUserBalance = balancesData?.balances?.find((b) => b.userId === user?.id);
  const netBalance = currentUserBalance?.netBalance ?? 0;

  return (
    <AppShell>
      <div className="px-5 pt-6 pb-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/groups"
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link
            href={`/expenses/new?groupId=${groupId}`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </Link>
        </div>

        {/* Group Header Card */}
        <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-950/10 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white font-bold flex items-center justify-center text-xl shadow-md">
              {group.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{group.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {(group.members || []).length} members • {formatMinorCurrency(balancesData?.totalExpenses ?? 0)} total spent
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Your balance in this group</p>
              <p className="text-lg font-bold mt-0.5">
                {netBalance > 0 ? (
                  <span className="text-emerald-400">You are owed {formatMinorCurrency(netBalance)}</span>
                ) : netBalance < 0 ? (
                  <span className="text-rose-400">You owe {formatMinorCurrency(Math.abs(netBalance))}</span>
                ) : (
                  <span className="text-slate-300">All settled up (₹0)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Shareable Invite Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Shareable Group Code</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm sm:text-base font-extrabold tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 select-all">
                {group.inviteCode}
              </span>
              <span className="text-[11px] text-slate-400">Never exposes database IDs</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyInviteCode(group.inviteCode)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied!' : 'Copy ID'}</span>
            </button>

            <button
              onClick={() => handleShareInvite(group.name, group.inviteCode)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Invite</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-5">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'expenses'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Expenses</span>
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'balances'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Balances</span>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'members'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({(group.members || []).length})</span>
          </button>
        </div>

        {/* Tab 1: Expenses */}
        {activeTab === 'expenses' && (
          <div>
            {expensesLoading ? (
              <div className="space-y-2.5 animate-pulse">
                <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
                <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
              </div>
            ) : expensesList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No expenses in this group yet.</p>
                <Link
                  href={`/expenses/new?groupId=${groupId}`}
                  className="mt-3 inline-block px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium"
                >
                  Add the first expense
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {expensesList.map((exp) => {
                  const isPayer = exp.paidBy === user?.id;
                  const mySplit = exp.splits.find((s) => s.userId === user?.id);
                  const myShare = mySplit ? mySplit.amountOwed : 0;

                  return (
                    <Link
                      key={exp.id}
                      href={`/expenses/${exp.id}`}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-slate-200 transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-sm">
                          {exp.description.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[170px]">
                            {exp.description}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {isPayer ? 'You' : exp.payer.name.split(' ')[0]} paid{' '}
                            {formatMinorCurrency(exp.totalAmount)} • {formatDate(exp.expenseDate)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {isPayer ? (
                          <div>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatMinorCurrency(exp.totalAmount - myShare)}
                            </p>
                            <p className="text-[10px] text-slate-400">you lent</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                              -{formatMinorCurrency(myShare)}
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
        )}

        {/* Tab 2: Balances & Settlements */}
        {activeTab === 'balances' && (
          <div className="space-y-6">
            {/* Simplified Settlements */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Suggested Settlements
              </h3>
              {(!settlementsData?.settlements || settlementsData.settlements.length === 0) ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    All balances are settled!
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    No money is currently owed in this group.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(settlementsData?.settlements || []).map((s, idx) => {
                    const youAreDebtor = s.fromUserId === user?.id;
                    const youAreCreditor = s.toUserId === user?.id;

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2.5">
                          <Send className="w-4 h-4 text-emerald-500 rotate-45" />
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                            {youAreDebtor ? (
                              <span className="font-bold text-rose-500">You</span>
                            ) : (
                              <span className="font-semibold">{s.fromUserName}</span>
                            )}{' '}
                            owes{' '}
                            {youAreCreditor ? (
                              <span className="font-bold text-emerald-500">You</span>
                            ) : (
                              <span className="font-semibold">{s.toUserName}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {formatMinorCurrency(s.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Individual Balances Breakdown */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Member Balances
              </h3>
              <div className="space-y-2">
                {(balancesData?.balances || []).map((b) => (
                  <div
                    key={b.userId}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {b.userName} {b.userId === user?.id && '(You)'}
                      </p>
                      <p className="text-[10px] text-slate-400">
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
                        <span className="text-xs font-medium text-slate-400">₹0</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Members */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Add Member Form */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
                <UserPlus className="w-4 h-4 text-emerald-500" />
                <span>Add Friend to Group</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                Enter your friend&apos;s registered email address.
              </p>

              {addMemberMsg && (
                <div
                  className={`mb-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                    addMemberMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {addMemberMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{addMemberMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleAddMember} className="flex gap-2">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="friend@example.com"
                  required
                  className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending || !memberEmail.trim()}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {addMemberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Add</span>}
                </button>
              </form>
            </div>

            {/* Members List */}
            <div className="space-y-2">
              {(group.members || []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-sm border border-slate-200/60 dark:border-slate-700">
                      {m.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {m.user.name} {m.userId === user?.id && '(You)'}
                      </p>
                      <p className="text-[11px] text-slate-400">{m.user.email}</p>
                    </div>
                  </div>

                  {m.user.telegramConnected && (
                    <span className="px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-full text-[10px] font-semibold flex items-center gap-1 border border-sky-100 dark:border-sky-900/40">
                      Telegram Connected
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
