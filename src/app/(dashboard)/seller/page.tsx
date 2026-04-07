"use client";

import { useEffect, useState } from "react";

interface ListingStats {
  id: string;
  title: string;
  view_count: number;
  trial_count: number;
  purchase_count: number;
  revenue: number;
}

interface DashboardData {
  total_revenue: number;
  total_purchases: number;
  active_listings: number;
  listings: ListingStats[];
}

interface Settlement {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function SellerDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, settlRes] = await Promise.all([
          fetch("/api/seller/dashboard"),
          fetch("/api/seller/settlements"),
        ]);

        if (dashRes.ok) {
          setDashboard(await dashRes.json());
        }
        if (settlRes.ok) {
          const data = await settlRes.json();
          setSettlements(Array.isArray(data) ? data : data.settlements ?? []);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-gray-500">로딩 중...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">판매 대시보드</h1>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="border rounded-lg p-5">
          <p className="text-sm text-gray-500">총 매출</p>
          <p className="text-2xl font-bold mt-1">
            ₩{(dashboard?.total_revenue ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="border rounded-lg p-5">
          <p className="text-sm text-gray-500">총 판매건수</p>
          <p className="text-2xl font-bold mt-1">
            {dashboard?.total_purchases ?? 0}건
          </p>
        </div>
        <div className="border rounded-lg p-5">
          <p className="text-sm text-gray-500">활성 리스팅</p>
          <p className="text-2xl font-bold mt-1">
            {dashboard?.active_listings ?? 0}개
          </p>
        </div>
      </div>

      {/* Listings table */}
      <section className="mb-8">
        <h2 className="font-semibold text-lg mb-3">리스팅별 성과</h2>
        {dashboard?.listings && dashboard.listings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">제목</th>
                  <th className="py-2 pr-4">조회</th>
                  <th className="py-2 pr-4">시식</th>
                  <th className="py-2 pr-4">구매</th>
                  <th className="py-2">매출</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.listings.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{l.title}</td>
                    <td className="py-2 pr-4">{l.view_count}</td>
                    <td className="py-2 pr-4">{l.trial_count}</td>
                    <td className="py-2 pr-4">{l.purchase_count}</td>
                    <td className="py-2">
                      ₩{l.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">등록된 리스팅이 없습니다.</p>
        )}
      </section>

      {/* Settlements */}
      <section>
        <h2 className="font-semibold text-lg mb-3">정산 내역</h2>
        {settlements.length > 0 ? (
          <div className="space-y-2">
            {settlements.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <p className="font-medium">
                    ₩{s.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(s.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    s.status === "completed"
                      ? "bg-green-50 text-green-600"
                      : "bg-yellow-50 text-yellow-600"
                  }`}
                >
                  {s.status === "completed" ? "완료" : "대기중"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">정산 내역이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
