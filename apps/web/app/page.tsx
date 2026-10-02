'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  UserCheck,
  Send,
  Heart,
  CheckCircle2,
  Sparkles,
  Receipt,
  Layers
} from 'lucide-react';

function InstagramIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Creator Announcement Bar */}
      <aside aria-label="Creator notice" className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white py-2.5 px-4 text-xs border-b border-slate-800 shadow-sm relative z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-300">
              Made with <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline mx-0.5" /> by <strong className="text-white font-semibold">Neel Sheth</strong>
            </span>
            <span className="hidden sm:inline text-slate-400">· for people who are tired of ads</span>
          </div>

          <a
            href="https://instagram.com/neel_afterhours"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 hover:text-white hover:bg-pink-500/25 transition-all text-xs font-semibold shrink-0 group shadow-sm"
            title="Follow Neel Sheth on Instagram"
          >
            <InstagramIcon className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
            <span>@neel_afterhours</span>
            <ArrowRight className="w-3 h-3 text-pink-400/70 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </aside>

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#fafbfc]/80 dark:bg-[#090d16]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              ₹
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              Splitwise Private
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoading ? null : user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-slate-900 dark:bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-5 w-full">
        {/* Hero Section */}
        <section className="pt-12 sm:pt-20 pb-12 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-semibold text-emerald-900 dark:text-emerald-300 mb-6 shadow-sm animate-in fade-in slide-in-from-top-3">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
            <span>Made with love by <strong>Neel Sheth</strong></span>
            <span className="text-emerald-300 dark:text-emerald-700">·</span>
            <a
              href="https://instagram.com/neel_afterhours"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
            >
              <InstagramIcon className="w-3 h-3 text-pink-500" />
              <span>@neel_afterhours</span>
            </a>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.12] mb-5">
            Split expenses.<br />
            <span className="text-emerald-600 dark:text-emerald-400">Not friendships.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-lg mx-auto font-normal leading-relaxed mb-8">
            Track who paid, who owes, and where your money went. Simple, private, and 100% ad-free for you and your circle.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-md mx-auto mb-6">
            <Link
              href="/register"
              className="w-full sm:w-auto px-7 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/10 text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Get Started — It&apos;s Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-2xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-center"
            >
              Already a user? Sign in
            </Link>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            No advertisements. No OTP. No corporate nonsense.
          </p>
        </section>

        {/* Live App Aesthetic Mockup */}
        <section className="mb-16 sm:mb-24">
          <div className="max-w-sm sm:max-w-md mx-auto p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-slate-900/5">
            {/* Mock Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">
                  A
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Good evening, Alex 👋</h4>
                  <p className="text-[10px] text-slate-400">October Overview</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                +₹1,500 net
              </span>
            </div>

            {/* Quick 1-to-1 Mock */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 mb-3">
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <span>🍕 Dinner with Lucas</span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">+₹600</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                You paid ₹1,200 • Lucas owes you ₹600 (50/50 split)
              </p>
            </div>

            {/* Group Trip Mock */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-900 dark:text-white">🌴 Goa Trip (Group)</span>
                <span className="text-slate-900 dark:text-white">₹18,720 total</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lucas & Noah owe you ₹1,500 total
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16 sm:mb-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              How it works
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Three simple steps to financial peace of mind.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm mb-3 mx-auto sm:mx-0">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Add Friends</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Add friends using their registered email. No phone numbers or address book syncing needed.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm mb-3 mx-auto sm:mx-0">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Add Expenses</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Log quick 1-to-1 expenses or create groups for vacations, roommates, and events.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm mb-3 mx-auto sm:mx-0">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Settle Up</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Our algorithm simplifies all mutual debts into the fewest possible payments.
              </p>
            </div>
          </div>
        </section>

        {/* Two Ways to Use It */}
        <section className="mb-16 sm:mb-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Two ways to use it
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Built for everyday flexibility.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-500 font-bold flex items-center justify-center mb-4">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                Quick 1-to-1 Expenses
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Going out with one friend? No need to create a whole group. Split dinner, coffee, or a cab directly.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium">
                ☕ <b>Coffee with Liam</b>: You paid ₹240 → Liam owes you ₹120.
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 font-bold flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                Groups & Trips
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Perfect for flatmates, road trips, college events, and vacations. Track dozens of expenses in one place.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium">
                🏖️ <b>Goa Trip</b>: 8 friends, ₹18,420 total expenses automatically settled.
              </div>
            </div>
          </div>
        </section>

        {/* Telegram Notifications Section */}
        <section className="mb-16 sm:mb-24 p-6 sm:p-10 rounded-3xl bg-slate-900 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-sky-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
              <Send className="w-7 h-7" />
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="text-lg sm:text-xl font-bold mb-2">
                Instant Telegram Notifications
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                Add an expense, and your friends immediately receive a clean notification on Telegram. At the end of every month, everyone receives an automated personal summary with their net settlement.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero phone numbers or SMS OTPs needed</span>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Philosophy */}
        <section className="mb-16 sm:mb-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white mb-3">
            Why people love it
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
            Existing apps became slow, bloated with ads, and full of unnecessary subscriptions. We built what friends actually need.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
              <div className="text-base font-bold text-slate-900 dark:text-white mb-0.5">Zero Ads</div>
              <p className="text-[11px] text-slate-400">Never interrupted</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
              <div className="text-base font-bold text-slate-900 dark:text-white mb-0.5">No OTP</div>
              <p className="text-[11px] text-slate-400">Instant email auth</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
              <div className="text-base font-bold text-slate-900 dark:text-white mb-0.5">100% Free</div>
              <p className="text-[11px] text-slate-400">No paywalls or tiers</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
              <div className="text-base font-bold text-slate-900 dark:text-white mb-0.5">Mobile First</div>
              <p className="text-[11px] text-slate-400">Thumb-friendly UX</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mb-20 text-center py-10 px-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
            Stop calculating expenses in WhatsApp.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-6">
            Start keeping track with your friends in seconds.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-md text-sm transition-all active:scale-95"
          >
            <span>Get Started — It&apos;s Free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      {/* Tasteful Creator Credit Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800 py-10 text-center">
        <div className="max-w-4xl mx-auto px-5">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 mb-1.5">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>by Neel Sheth</span>
          </p>

          <a
            href="https://instagram.com/neel_afterhours"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline mb-4"
          >
            <span>@neel_afterhours</span>
          </a>

          <p className="text-[11px] text-slate-400">
            © 2026 Splitwise Private. Built for friends, not advertisers.
          </p>
        </div>
      </footer>
    </div>
  );
}
