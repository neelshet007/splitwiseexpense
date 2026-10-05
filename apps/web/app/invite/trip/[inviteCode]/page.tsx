'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TripPreviewResponse, TripItem } from '@splitwise/types';
import {
  Compass,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Palmtree,
  ShieldCheck
} from 'lucide-react';

export default function TripInvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = (params.inviteCode as string)?.toUpperCase();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch trip preview (works logged in or logged out)
  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError
  } = useQuery<TripPreviewResponse>({
    queryKey: ['trip-invite', inviteCode],
    queryFn: () => apiFetch<TripPreviewResponse>(`/api/trips/invite/${inviteCode}`),
    enabled: !!inviteCode
  });

  // 2. Join mutation
  const joinMutation = useMutation({
    mutationFn: () =>
      apiFetch<TripItem>('/api/trips/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode })
      }),
    onSuccess: (joinedTrip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      router.push(`/trips/${joinedTrip.id}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to join trip');
    }
  });

  const handleJoin = () => {
    setErrorMsg(null);
    joinMutation.mutate();
  };

  if (previewLoading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading trip invite...</p>
        </div>
      </div>
    );
  }

  if (previewError || !preview) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h1 className="text-base font-bold text-slate-900 dark:text-white mb-1">Invalid Trip Invite</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            This invite code ({inviteCode}) could not be found or has expired.
          </p>
          <Link
            href="/trips"
            className="inline-block w-full py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-semibold"
          >
            Go to Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-slate-50 dark:from-slate-900/60 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Palmtree className="w-7 h-7" />
          </div>
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
            Trip Invitation
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {preview.name}
          </h1>
          {preview.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {preview.description}
            </p>
          )}
        </div>

        {/* Trip Metadata Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Organized by</span>
            <span className="font-semibold text-slate-900 dark:text-white">{preview.creatorName}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Current Members</span>
            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{preview.memberCount}</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">Trip ID</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {preview.inviteCode}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        {preview.isMember ? (
          <div className="space-y-2">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>You are already in this trip!</span>
            </div>
            <Link
              href={`/trips/${preview.id}`}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Go to Trip Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : user ? (
          <button
            onClick={handleJoin}
            disabled={joinMutation.isPending}
            className="w-full py-3 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {joinMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Join {preview.name}</span>
          </button>
        ) : (
          <div className="space-y-2.5">
            <Link
              href={`/login?redirect=/invite/trip/${inviteCode}`}
              className="w-full py-3 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <span>Log in to Join Trip</span>
            </Link>
            <Link
              href={`/register?redirect=/invite/trip/${inviteCode}`}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center"
            >
              <span>Create an Account</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
