"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/personas" className="font-bold text-lg">
          Human Archive <span className="text-blue-600">AI</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/personas"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            페르소나
          </Link>
          <Link
            href="/api-keys"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            API 키
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  );
}
