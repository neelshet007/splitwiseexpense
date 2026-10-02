import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';

export default function NotFound() {
  return (
    <AppShell>
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-emerald-500 font-extrabold flex items-center justify-center text-2xl mb-4 shadow-sm">
          404
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Page Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
          The page or expense group you are looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-slate-900 dark:bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-all"
        >
          Return Home
        </Link>
      </div>
    </AppShell>
  );
}
