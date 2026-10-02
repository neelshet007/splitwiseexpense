'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Plus, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/dashboard', icon: Home },
    { label: 'Groups', href: '/groups', icon: Users },
    { label: 'Add', href: '/expenses/new', icon: Plus, isAction: true },
    { label: 'Activity', href: '/activity', icon: Clock },
    { label: 'Me', href: '/settings', icon: User }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-4 flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 dark:bg-emerald-500 text-white shadow-lg shadow-slate-900/25 active:scale-95 transition-transform"
                aria-label="Add Expense"
              >
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'text-slate-900 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <Icon className={cn('w-5 h-5 mb-1', isActive && 'stroke-[2.5]')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
