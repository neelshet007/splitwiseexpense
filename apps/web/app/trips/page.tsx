'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TripItem } from '@splitwise/types';
import { AppShell } from '@/components/layout/AppShell';
import {
  Compass,
  Plus,
  Users,
  Copy,
  Check,
  ChevronRight,
  Search,
  Sparkles,
  Palmtree,
  Receipt,
  Share2,
  Calendar,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function TripsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Create form state
  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Copied invite code tracking
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: trips, isLoading } = useQuery<TripItem[]>({
    queryKey: ['trips'],
    queryFn: () => apiFetch<TripItem[]>('/api/trips'),
    enabled: !!user
  });

  const createTripMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      apiFetch<TripItem>('/api/trips', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: (newTrip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setShowCreateModal(false);
      setNewTripName('');
      setNewTripDesc('');
      setCreateError(null);
      router.push(`/trips/${newTrip.id}`);
    },
    onError: (err: any) => {
      setCreateError(err.message || 'Failed to create trip');
    }
  });

  const joinTripMutation = useMutation({
    mutationFn: (inviteCode: string) =>
      apiFetch<TripItem>('/api/trips/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
      }),
    onSuccess: (joinedTrip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setShowJoinModal(false);
      setJoinCode('');
      setJoinError(null);
      router.push(`/trips/${joinedTrip.id}`);
    },
    onError: (err: any) => {
      setJoinError(err.message || 'Failed to join trip');
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim()) return;
    setCreateError(null);
    createTripMutation.mutate({
      name: newTripName.trim(),
      description: newTripDesc.trim() || undefined
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinError(null);
    joinTripMutation.mutate(joinCode.trim());
  };

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredTrips = (trips || []).filter((trip) => {
    const matchesSearch =
      trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trip.description && trip.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      trip.inviteCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = filterTab === 'ARCHIVED' ? trip.isArchived : !trip.isArchived;
    return matchesSearch && matchesTab;
  });

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Compass className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Trips</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Shared spaces for vacations, weekend getaways & group outings
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Join Trip
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Trip</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-5">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by trip name or code (e.g. Goa, GOA-7K4P2X)..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-none rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'ACTIVE'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Active Trips
          </button>
          <button
            onClick={() => setFilterTab('ARCHIVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'ARCHIVED'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Past / Archived
          </button>
        </div>

        {/* Trips List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Palmtree className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              {searchQuery ? 'No matching trips found' : filterTab === 'ARCHIVED' ? 'No archived trips' : 'No trips planned yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-5">
              {searchQuery
                ? 'Try a different search keyword or trip code.'
                : 'Create a dedicated trip space for your upcoming vacation, road trip, or group event.'}
            </p>
            {!searchQuery && filterTab === 'ACTIVE' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Trip</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredTrips.map((trip) => {
              const memberCount = trip.members?.length || trip._count?.members || 1;
              const expenseCount = trip._count?.expenses || 0;
              const isCreator = trip.createdBy === user?.id;

              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="block p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        {trip.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {trip.name}
                          </h3>
                          {isCreator && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              Admin
                            </span>
                          )}
                        </div>
                        {trip.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {trip.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleCopyCode(e, trip.inviteCode)}
                        title="Copy Trip Invite Code"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        {copiedCode === trip.inviteCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{trip.inviteCode}</span>
                          </>
                        )}
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-slate-400" />
                      <span>{expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'}</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Modal: Create Trip */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <span className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Palmtree className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Create New Trip</h2>
                  <p className="text-xs text-slate-500">A shared space for trip expenses</p>
                </div>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trip Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                    placeholder="e.g. Goa Trip, College Trip, Manali Outing"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newTripDesc}
                    onChange={(e) => setNewTripDesc(e.target.value)}
                    placeholder="e.g. Vacation with college friends, October 2026"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTripMutation.isPending || !newTripName.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {createTripMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Create Trip</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Join Trip */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
              <button
                onClick={() => setShowJoinModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <span className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Compass className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Join a Trip</h2>
                  <p className="text-xs text-slate-500">Enter a Trip ID or invite code</p>
                </div>
              </div>

              {joinError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trip Code
                  </label>
                  <input
                    type="text"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. GOA-7K4P2X"
                    className="w-full px-3.5 py-2.5 font-mono uppercase bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Ask your trip organizer for the 6-to-10 character code.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joinTripMutation.isPending || !joinCode.trim()}
                    className="px-4 py-2 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {joinTripMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Join Trip</span>
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
