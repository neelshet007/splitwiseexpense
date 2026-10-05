'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { FriendItem } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { formatMinorCurrency } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Plus,
  PlusCircle,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Receipt
} from 'lucide-react';

export default function FriendsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [modalFeedback, setModalFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const { data: friends, isLoading, error } = useQuery<FriendItem[]>({
    queryKey: ['friends'],
    queryFn: () => apiFetch<FriendItem[]>('/api/friends')
  });

  const addFriendMutation = useMutation({
    mutationFn: (targetEmail: string) =>
      apiFetch<FriendItem>('/api/friends/add', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail })
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setModalFeedback({
        type: 'success',
        message: `${data.friend.name} added to your friends list!`
      });
      setEmail('');
      setTimeout(() => {
        setIsModalOpen(false);
        setModalFeedback(null);
      }, 1500);
    },
    onError: (err: any) => {
      setModalFeedback({
        type: 'error',
        message: err.message || 'Failed to add friend'
      });
    }
  });

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setModalFeedback(null);
    addFriendMutation.mutate(email.trim());
  };

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Friends</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              People you regularly split expenses with
            </p>
          </div>
          <button
            onClick={() => {
              setModalFeedback(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Friend</span>
          </button>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load friends list.</div>
        ) : friends?.length === 0 ? (
          /* Empty state */
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No friends added yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 mb-5">
              Add someone you regularly share dinner, coffee, cabs, or groceries with.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-sm hover:bg-emerald-600 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add a Friend</span>
            </button>
          </div>
        ) : (
          /* Friends list */
          <div className="space-y-3">
            {friends?.map((item) => {
              const owesYou = item.netBalance > 0;
              const youOwe = item.netBalance < 0;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between group"
                >
                  <Link
                    href={`/friends/${item.friendId}`}
                    className="flex items-center gap-3.5 flex-1 min-w-0"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center text-base border border-slate-200/60 dark:border-slate-700 group-hover:scale-105 transition-transform flex-shrink-0">
                      {item.friend.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {item.friend.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">{item.friend.email}</p>

                      <div className="mt-1">
                        {owesYou ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMinorCurrency(item.netBalance)} owed to you
                          </span>
                        ) : youOwe ? (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            You owe {formatMinorCurrency(Math.abs(item.netBalance))}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">
                            All settled up (₹0)
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                    <Link
                      href={`/friends/${item.friendId}`}
                      className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold hidden sm:inline-block"
                    >
                      View
                    </Link>
                    <Link
                      href={`/expenses/new?friendId=${item.friendId}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Split</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add a Friend</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalFeedback && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {modalFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{modalFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleAddFriend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Friend&apos;s Registered Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Must be registered on Splitwise Private. We never create fake accounts.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFriendMutation.isPending || !email.trim()}
                  className="flex-1 py-3 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {addFriendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Add Friend</span>
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
