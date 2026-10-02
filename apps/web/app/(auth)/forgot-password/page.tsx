'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordInput } from '@splitwise/validation';
import { apiFetch } from '@/lib/api';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      setServerError(null);
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setIsSuccess(true);
    } catch (err: any) {
      setServerError(err.message || 'Failed to submit request');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-sm mx-auto">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to sign in</span>
        </Link>

        {isSuccess ? (
          <div className="text-center bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Check your email</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              If an account matches your email, we have sent instructions to reset your password.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 px-4 bg-slate-900 dark:bg-emerald-500 text-white font-medium rounded-xl text-sm"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot password?</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Enter your registered email address to receive a secure reset link.
              </p>
            </div>

            {serverError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="neel@example.com"
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-medium rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Send Reset Link</span>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
