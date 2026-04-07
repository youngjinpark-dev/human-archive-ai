"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Purchase {
  id: string;
  persona_id: string;
  listing_id: string;
  amount_krw: number;
  status: string;
  created_at: string;
  persona_name?: string;
  listing_title?: string;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/purchases")
      .then((r) => r.json())
      .then((data) => {
        setPurchases(Array.isArray(data) ? data : data.purchases ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">구매 내역</h1>

      {loading ? (
        <p className="text-gray-500">로딩 중...</p>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">구매한 페르소나가 없습니다.</p>
          <Link
            href="/store"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            스토어 둘러보기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {purchases.map((p) => (
            <div key={p.id} className="border rounded-lg p-5">
              <h3 className="font-semibold text-lg">
                {p.listing_title ?? p.persona_name ?? "페르소나"}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {new Date(p.created_at).toLocaleDateString("ko-KR")}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                ₩{p.amount_krw.toLocaleString()}
              </p>
              <Link
                href={`/personas/${p.persona_id}/chat`}
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                대화하기
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
