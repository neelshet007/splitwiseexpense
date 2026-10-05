'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@splitwise/validation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { TelegramStatusResponse } from '@splitwise/types';
import {
  AlertCircle,
  Lock,
  Mail,
  User,
  ArrowRight,
  Loader2,
  Send,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, refreshUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  // Post-registration Telegram setup state
  const [accountCreated, setAccountCreated] = useState(false);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      setServerError(null);
      // Register without immediately navigating to dashboard
      await registerUser(data, false);
      setAccountCreated(true);
      fetchTelegramConnectLink();
    } catch (err: any) {
      setServerError(err.message || 'Failed to create account. Please try again.');
    }
  };

  const fetchTelegramConnectLink = async () => {
    try {
      setTelegramLoading(true);
      const res = await apiFetch<{ url: string }>('/api/telegram/connect', {
        method: 'POST'
      });
      setTelegramLinkUrl(res.url);
    } catch {
      // Gracefully handled; user can retry via button
    } finally {
      setTelegramLoading(false);
    }
  };

  // Poll for Telegram connection status once on setup screen
  useEffect(() => {
    if (!accountCreated || isConnected) return;

    const interval = setInterval(async () => {
      try {
        const status = await apiFetch<TelegramStatusResponse>('/api/telegram/status');
        if (status.connected) {
          setIsConnected(true);
          await refreshUser();
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        }
      } catch {
        // Silently continue polling
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [accountCreated, isConnected, refreshUser, router]);

  // If account was created, show the dedicated "Connect Telegram" screen
  if (accountCreated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-6 py-12">
        <div className="w-full max-w-sm mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-sky-500/10 text-sky-500 mb-6 shadow-sm">
            <Send className="w-8 h-8 -rotate-12 translate-x-0.5" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Connect Telegram</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            To receive expense notifications and reset your password through Telegram, start our Telegram bot.
          </p>

          {isConnected ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2 mb-6 animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Telegram connected successfully! Redirecting...</span>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <a
                href={telegramLinkUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (!telegramLinkUrl) fetchTelegramConnectLink();
                }}
                className={`w-full py-3.5 px-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/20 text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${
                  telegramLoading ? 'opacity-70 pointer-events-none' : ''
                }`}
              >
                {telegramLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Open Telegram</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </a>

              <p className="text-[11px] text-slate-400">
                After starting the bot, your account will be connected automatically.
              </p>
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            I&apos;ll do this later → Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-emerald-500 text-white font-bold text-2xl shadow-lg mb-4">
            ₹
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create an account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simple, ad-free friend expense sharing
          </p>
        </div>

        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('name')}
                type="text"
                placeholder="Your full name"
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
              />
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('password')}
                type="password"
                placeholder="•••••••••••"
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
              />
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Telegram Username
            </label>
            <div className="relative">
              <Send className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('telegramUsername')}
                type="text"
                placeholder="@yourusername"
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
              />
            </div>
            {errors.telegramUsername && (
              <p className="text-xs text-red-500 mt-1">{errors.telegramUsername.message}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Used to identify and connect your account with our Telegram bot.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-70 mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
