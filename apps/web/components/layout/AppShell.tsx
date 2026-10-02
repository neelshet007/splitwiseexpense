'use client';

import React from 'react';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function AppShell({ children, showNav = true }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center">
      {/* Target mobile viewport container: 375px to 430px */}
      <main className="w-full max-w-md min-h-screen bg-white dark:bg-slate-900 border-x border-slate-200/80 dark:border-slate-800 flex flex-col relative shadow-sm">
        <div className="flex-1 pb-20">{children}</div>
        {showNav && <BottomNav />}
      </main>
    </div>
  );
}
