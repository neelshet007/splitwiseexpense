'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { Home, UserCheck, Users, Plus, Clock, User, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function AppShell({ children, showNav = true }: AppShellProps) {
  const pathname = usePathname();

  const desktopNavItems = [
    { label: 'Home', href: '/dashboard', icon: Home },
    { label: 'Friends', href: '/friends', icon: UserCheck },
    { label: 'Groups', href: '/groups', icon: Users },
    { label: 'Activity', href: '/activity', icon: Clock },
    { label: 'Me', href: '/settings', icon: User }
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-5xl flex justify-center">
        {/* Desktop Left Sidebar (visible on md: screens and above) */}
        {showNav && (
          <aside className="hidden md:flex flex-col justify-between w-64 p-6 border-r border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm min-h-screen sticky top-0 h-screen">
            <div>
              {/* Brand Header */}
              <Link href="/dashboard" className="flex items-center gap-2.5 mb-8">
                <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  ₹
                </div>
                <div>
                  <h1 className="font-bold text-sm text-slate-900 dark:text-white">Splitwise Private</h1>
                  <p className="text-[10px] text-slate-400">Ad-free friend expenses</p>
                </div>
              </Link>

              {/* Add Expense Action Button */}
              <Link
                href="/expenses/new"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-md text-xs transition-all mb-6 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Expense</span>
              </Link>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {desktopNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all',
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Subtle Creator Credit in Sidebar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>Made with</span>
                <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
                <span>by Neel Sheth</span>
              </p>
              <a
                href="https://instagram.com/neel_afterhours"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                @neel_afterhours
              </a>
            </div>
          </aside>
        )}

        {/* Center Application Content (Target: 375px - 480px on mobile, comfortably centered on desktop) */}
        <main className="w-full max-w-md sm:max-w-lg min-h-screen bg-white dark:bg-slate-900 border-x border-slate-200/80 dark:border-slate-800 flex flex-col relative shadow-sm">
          <div className="flex-1 pb-20 md:pb-6">{children}</div>

          {/* Bottom Navigation for Mobile Devices */}
          {showNav && (
            <div className="md:hidden">
              <BottomNav />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
