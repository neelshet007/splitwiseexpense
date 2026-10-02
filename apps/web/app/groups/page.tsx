'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { GroupItem } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import { Users, Plus, ChevronRight, Loader2, X, KeyRound, Sparkles } from 'lucide-react';

export default function GroupsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joinErrorMsg, setJoinErrorMsg] = useState<string | null>(null);

  const { data: groups, isLoading, error } = useQuery<GroupItem[]>({
    queryKey: ['groups'],
    queryFn: () => apiFetch<GroupItem[]>('/api/groups')
  });

  const createGroupMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<GroupItem>('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name })
      }),
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsModalOpen(false);
      setGroupName('');
      setErrorMsg(null);
      router.push(`/groups/${newGroup.id}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create group');
    }
  });

  const joinGroupMutation = useMutation({
    mutationFn: (inviteCode: string) =>
      apiFetch<GroupItem>('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode })
      }),
    onSuccess: (joinedGroup) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setIsJoinModalOpen(false);
      setInviteCodeInput('');
      setJoinErrorMsg(null);
      router.push(`/groups/${joinedGroup.id}`);
    },
    onError: (err: any) => {
      setJoinErrorMsg(err.message || 'Failed to join group. Check the invite code.');
    }
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    createGroupMutation.mutate(groupName);
  };

  const handleJoinGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    joinGroupMutation.mutate(inviteCodeInput.trim());
  };

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Expense Groups</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your shared circles</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setJoinErrorMsg(null);
                setIsJoinModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all active:scale-95"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
              <span>Join</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-500">Failed to load groups.</div>
        ) : groups?.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No groups yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Create a group for your apartment, trip, or friend circle.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-emerald-500 text-white font-medium rounded-xl text-xs"
            >
              Create your first group
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups?.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 hover:border-emerald-500/40 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-base border border-emerald-100 dark:border-emerald-900/40">
                    {group.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{group.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {group.members.length} {group.members.length === 1 ? 'member' : 'members'} •{' '}
                      {group._count?.expenses ?? 0} expenses
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Group</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Goa Trip, Flatmates, Weekend Trek"
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
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
                  disabled={createGroupMutation.isPending || !groupName.trim()}
                  className="flex-1 py-3 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {createGroupMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Create</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Join Group</h3>
              </div>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter the unique invite code shared by your friend (e.g. <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">GOA-7K4P2X</span>).
            </p>

            {joinErrorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {joinErrorMsg}
              </div>
            )}

            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Group Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. GOA-7K4P2X"
                  autoFocus
                  required
                  className="w-full px-4 py-3 font-mono font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinGroupMutation.isPending || !inviteCodeInput.trim()}
                  className="flex-1 py-3 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {joinGroupMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Join Group</span>
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
