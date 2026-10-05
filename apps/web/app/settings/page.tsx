'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { TelegramStatusResponse, SafeUser } from '@splitwise/types';
import {
  User,
  Send,
  LogOut,
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Bell,
  Edit2,
  X,
  Check,
  ShieldAlert
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  // Edit Telegram Username modal state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newTelegramUsername, setNewTelegramUsername] = useState('');

  // Telegram status query
  const { data: tgStatus, isLoading: tgLoading } = useQuery<TelegramStatusResponse>({
    queryKey: ['telegram-status'],
    queryFn: () => apiFetch<TelegramStatusResponse>('/api/telegram/status'),
    enabled: !!user
  });

  // Connect Telegram mutation
  const connectTelegramMutation = useMutation({
    mutationFn: () => apiFetch<{ url: string }>('/api/telegram/connect', { method: 'POST' }),
    onSuccess: (data) => {
      window.open(data.url, '_blank');
    },
    onError: (err: any) => {
      setTelegramError(err.message || 'Failed to initiate Telegram connection');
    }
  });

  // Disconnect Telegram mutation
  const disconnectTelegramMutation = useMutation({
    mutationFn: () => apiFetch('/api/telegram/disconnect', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-status'] });
      refreshUser();
    },
    onError: (err: any) => {
      setTelegramError(err.message || 'Failed to disconnect Telegram');
    }
  });

  // Update Telegram Username mutation
  const updateUsernameMutation = useMutation({
    mutationFn: (username: string) =>
      apiFetch('/api/telegram/username', {
        method: 'PATCH',
        body: JSON.stringify({ telegramUsername: username })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-status'] });
      refreshUser();
      setIsEditingUsername(false);
    },
    onError: (err: any) => {
      setTelegramError(err.message || 'Failed to update Telegram username');
    }
  });

  // Update Notification Preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (prefs: Partial<TelegramStatusResponse['preferences']>) =>
      apiFetch('/api/telegram/preferences', {
        method: 'PATCH',
        body: JSON.stringify(prefs)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-status'] });
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (newName: string) =>
      apiFetch<SafeUser>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: newName })
      }),
    onSuccess: () => {
      refreshUser();
      setProfileMsg('Name updated successfully!');
      setTimeout(() => setProfileMsg(null), 3000);
    },
    onError: (err: any) => {
      setProfileMsg(err.message || 'Failed to update profile');
    }
  });

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfileMutation.mutate(name.trim());
  };

  const handleUpdateUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTelegramUsername.trim()) return;
    updateUsernameMutation.mutate(newTelegramUsername.trim());
  };

  const togglePreference = (key: keyof TelegramStatusResponse['preferences']) => {
    if (!tgStatus) return;
    const currentVal = tgStatus.preferences[key];
    updatePreferencesMutation.mutate({ [key]: !currentVal });
  };

  const isConnected = tgStatus?.connected ?? false;
  const currentUsername = tgStatus?.telegramUsername || user?.telegramUsername || 'Not set';

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-8">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Profile</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Manage your account and Telegram alerts</p>

        {/* User Card */}
        <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-white font-bold text-2xl flex items-center justify-center shadow-sm">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{user?.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* 1. Telegram Connection Card (Section 5, 15) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Telegram</h3>
                <p className="text-[11px] text-slate-400">Expense notifications & password reset</p>
              </div>
            </div>

            {/* Connection Status Badge */}
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>Not connected</span>
              </span>
            )}
          </div>

          {telegramError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{telegramError}</span>
            </div>
          )}

          {/* Telegram Username Display & Edit */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Telegram Username
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">
                {currentUsername}
              </span>
            </div>

            <button
              onClick={() => {
                setNewTelegramUsername(currentUsername.startsWith('@') ? currentUsername : `@${currentUsername}`);
                setIsEditingUsername(true);
              }}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" />
              <span>Change</span>
            </button>
          </div>

          {/* Actions: Connect / Change Telegram */}
          {isConnected ? (
            <div className="flex gap-2">
              <button
                onClick={() => connectTelegramMutation.mutate()}
                disabled={connectTelegramMutation.isPending}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                {connectTelegramMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-sky-500" />
                    <span>Reconnect Bot</span>
                  </>
                )}
              </button>

              <button
                onClick={() => disconnectTelegramMutation.mutate()}
                disabled={disconnectTelegramMutation.isPending}
                className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold transition-colors"
              >
                {disconnectTelegramMutation.isPending ? '...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => connectTelegramMutation.mutate()}
              disabled={connectTelegramMutation.isPending}
              className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              {connectTelegramMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Connect Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>

        {/* 2. Telegram Notification Preferences (Section 7, 15) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Telegram Notifications</h3>
              <p className="text-[11px] text-slate-400">Choose which updates arrive on Telegram</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'notifyExpenseAdded',
                label: 'Expense added',
                desc: 'When you or a friend adds a direct or group expense'
              },
              {
                id: 'notifyMonthlySummary',
                label: 'Monthly summary',
                desc: 'Personal financial ledger summary at end of month'
              },
              {
                id: 'notifySettlements',
                label: 'Settlement updates',
                desc: 'When a friend settles up with you or vice versa'
              },
              {
                id: 'notifyPasswordReset',
                label: 'Password reset',
                desc: 'Security notifications and password reset links'
              }
            ].map((pref) => {
              const checked = tgStatus?.preferences ? (tgStatus.preferences as any)[pref.id] : true;

              return (
                <div
                  key={pref.id}
                  onClick={() => togglePreference(pref.id as any)}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="pr-4">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{pref.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{pref.desc}</p>
                  </div>

                  <div
                    className={`w-10 h-6 rounded-full transition-colors flex items-center p-0.5 flex-shrink-0 ${
                      checked ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-sm"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Profile Display Name Form */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 mb-6">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-slate-500" />
            <span>Profile Details</span>
          </h3>

          {profileMsg && (
            <p className="text-xs text-emerald-600 font-semibold mb-3">{profileMsg}</p>
          )}

          <form onSubmit={handleUpdateName} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={updateProfileMutation.isPending || !name.trim()}
              className="py-2.5 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center active:scale-95"
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Name'}
            </button>
          </form>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={() => logout()}
          className="w-full py-3.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

        {/* Edit Telegram Username Modal */}
        {isEditingUsername && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Telegram</h3>
                <button
                  onClick={() => setIsEditingUsername(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateUsernameSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Telegram Username
                  </label>
                  <input
                    type="text"
                    value={newTelegramUsername}
                    onChange={(e) => setNewTelegramUsername(e.target.value)}
                    placeholder="@yourusername"
                    autoFocus
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Enter your Telegram handle. We use this to recognize your account when you message the bot.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingUsername(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateUsernameMutation.isPending || !newTelegramUsername.trim()}
                    className="flex-1 py-3 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {updateUsernameMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Save</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
