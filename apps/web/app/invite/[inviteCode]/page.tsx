'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { GroupPreviewResponse, GroupItem } from '@splitwise/types';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Heart
} from 'lucide-react';

export default function GroupInvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = (params.inviteCode as string)?.toUpperCase();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch group preview (works logged in or logged out)
  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError
  } = useQuery<GroupPreviewResponse>({
    queryKey: ['group-invite', inviteCode],
    queryFn: () => apiFetch<GroupPreviewResponse>(`/api/groups/invite/${inviteCode}`),
    enabled: !!inviteCode
  });

  // 2. Join mutation
  const joinMutation = useMutation({
    mutationFn: () =>
      apiFetch<GroupItem>('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode })
      }),
    onSuccess: (joinedGroup) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      router.push(`/groups/${joinedGroup.id}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to join group');
    }
  });

  const handleJoin = () => {
    setErrorMsg(null);
    joinMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-5">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            ₹
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
            Splitwise Private
          </span>
        </Link>

        {user ? (
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href={`/login?redirect=/invite/${inviteCode}`}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Sign In
          </Link>
        )}
      </header>

      {/* Main Invite Card */}
      <main className="max-w-md mx-auto w-full my-auto py-8">
        {authLoading || previewLoading ? (
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-lg">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-3" />
            <p className="text-xs text-slate-500">Loading group invitation...</p>
          </div>
        ) : previewError || !preview ? (
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Invalid or Expired Invite
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-xs mx-auto">
              This group invite code was not found. Please double-check the link or ask the group creator for a new code.
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Group Invitation</span>
            </div>

            {/* Group Icon */}
            <div className="w-16 h-16 rounded-3xl bg-slate-900 dark:bg-emerald-500 text-white font-extrabold flex items-center justify-center text-2xl mx-auto mb-4 shadow-md">
              {preview.name.charAt(0).toUpperCase()}
            </div>

            {/* Title & Info */}
            <h1 className="text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight mb-1">
              {preview.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Created by <span className="font-semibold text-slate-700 dark:text-slate-200">{preview.creatorName}</span> • {preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'}
            </p>

            {/* Invite Code Tag */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-6">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                Invite Code
              </span>
              <span className="font-mono text-base font-extrabold tracking-widest text-slate-900 dark:text-white select-all">
                {preview.inviteCode}
              </span>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 text-left">
                {errorMsg}
              </div>
            )}

            {/* Action buttons based on auth state */}
            {user ? (
              preview.isMember ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>You are already a member of this group</span>
                  </div>
                  <Link
                    href={`/groups/${preview.id}`}
                    className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <span>Open Group Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joinMutation.isPending}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {joinMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Confirm & Join Group</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-2">
                  Sign in or create an account to join this expense circle.
                </p>
                <Link
                  href={`/login?redirect=/invite/${inviteCode}`}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <span>Sign In to Join</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href={`/register?redirect=/invite/${inviteCode}`}
                  className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-2xl text-xs flex items-center justify-center transition-colors"
                >
                  Create New Account
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Signature */}
      <footer className="max-w-md mx-auto w-full text-center pb-2">
        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1 font-medium">
          <span>Made with</span>
          <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
          <span>by Neel Sheth —</span>
          <a
            href="https://instagram.com/neel_afterhours"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
          >
            @neel_afterhours
          </a>
        </p>
      </footer>
    </div>
  );
}
