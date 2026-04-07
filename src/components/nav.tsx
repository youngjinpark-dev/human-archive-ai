"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/personas" className="font-bold text-lg text-slate-900 dark:text-white">
          Human Archive <span className="text-blue-600 dark:text-blue-400">AI</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/personas"
            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            페르소나
          </Link>
          <Link
            href="/store"
            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            스토어
          </Link>
          <Link
            href="/purchases"
            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            구매내역
          </Link>
          <Link
            href="/seller"
            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            판매 대시보드
          </Link>
          <Link
            href="/api-keys"
            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            API 키
          </Link>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  );
}
