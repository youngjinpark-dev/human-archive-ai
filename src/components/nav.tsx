"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/personas", label: "페르소나" },
  { href: "/store", label: "스토어" },
  { href: "/purchases", label: "구매내역" },
  { href: "/seller", label: "판매" },
  { href: "/api-keys", label: "API 키" },
];

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/personas" className="font-bold text-lg shrink-0 text-slate-900 dark:text-white">
          Human Archive <span className="text-blue-600 dark:text-blue-400">AI</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white whitespace-nowrap">
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
          <button onClick={handleLogout} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap">
            로그아웃
          </button>
        </div>

        {/* Mobile hamburger */}
        <div className="flex md:hidden items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 text-slate-600 dark:text-slate-300"
            aria-label="메뉴"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 space-y-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="block w-full text-left py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            로그아웃
          </button>
        </div>
      )}
    </nav>
  );
}
