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
  AlertCircle
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  // Telegram status
  const { data: tgStatus, isLoading: tgLoading } = useQuery<TelegramStatusResponse>({
    queryKey: ['telegram-status'],
    queryFn: () => apiFetch<TelegramStatusResponse>('/api/telegram/status'),
    enabled: !!user
  });

  // Connect Telegram mutation
  const connectTelegramMutation = useMutation({
    mutationFn: () => apiFetch<{ url: string }>('/api/telegram/connect', { method: 'POST' }),
    onSuccess: (data) => {
      // Open Telegram deep link in new tab or app
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

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Account & Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Manage your profile and Telegram alerts</p>

        {/* User Card */}
        <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-950/10 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white font-bold text-2xl flex items-center justify-center shadow-md">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{user?.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Telegram Integration Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Telegram Alerts</h3>
              <p className="text-[11px] text-slate-400">Real-time expense notifications & monthly summaries</p>
            </div>
          </div>

          {telegramError && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{telegramError}</span>
            </div>
          )}

          {tgLoading ? (
            <div className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl"></div>
          ) : tgStatus?.connected ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Connected {tgStatus.telegramUsername ? `@${tgStatus.telegramUsername}` : ''}</span>
                </div>
              </div>
              <button
                onClick={() => disconnectTelegramMutation.mutate()}
                disabled={disconnectTelegramMutation.isPending}
                className="w-full py-2.5 px-4 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl hover:bg-rose-100 transition-colors"
              >
                {disconnectTelegramMutation.isPending ? 'Disconnecting...' : 'Disconnect Telegram'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Connect your Telegram account to instantly receive expense notifications when friends add expenses,
                and receive a monthly settlement summary.
              </p>
              <button
                onClick={() => connectTelegramMutation.mutate()}
                disabled={connectTelegramMutation.isPending}
                className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
              >
                {connectTelegramMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Connect Telegram Account</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Edit Profile */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 mb-6">
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
              className="py-2.5 px-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center"
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Name'}
            </button>
          </form>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={() => logout()}
          className="w-full py-3.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </AppShell>
  );
}
