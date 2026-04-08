"use client";

import { useEffect, useState } from "react";

interface ListingStats {
  id: string;
  title: string;
  view_count: number;
  trial_count: number;
  purchase_count: number;
}

interface DashboardStats {
  total_sales: number;
  total_revenue: number;
  this_month_sales: number;
  this_month_revenue: number;
}

interface DashboardData {
  stats: DashboardStats;
  listings: ListingStats[];
}

interface Settlement {
  month: string;
  total: number;
  settled: number;
  unsettled: number;
  count: number;
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

  if (loading) return <p className="text-slate-500 dark:text-slate-400">로딩 중...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 dark:text-white">판매 대시보드</h1>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="border dark:border-slate-700 rounded-lg p-5 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">총 매출</p>
          <p className="text-2xl font-bold mt-1">
            ₩{(dashboard?.stats?.total_revenue ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="border dark:border-slate-700 rounded-lg p-5 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">총 판매건수</p>
          <p className="text-2xl font-bold mt-1">
            {dashboard?.stats?.total_sales ?? 0}건
          </p>
        </div>
        <div className="border dark:border-slate-700 rounded-lg p-5 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">이번 달 매출</p>
          <p className="text-2xl font-bold mt-1">
            ₩{(dashboard?.stats?.this_month_revenue ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="border dark:border-slate-700 rounded-lg p-5 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">이번 달 판매</p>
          <p className="text-2xl font-bold mt-1">
            {dashboard?.stats?.this_month_sales ?? 0}건
          </p>
        </div>
      </div>

      {/* Listings table */}
      <section className="mb-8">
        <h2 className="font-semibold text-lg mb-3 dark:text-white">리스팅별 성과</h2>
        {dashboard?.listings && dashboard.listings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-4">제목</th>
                  <th className="py-2 pr-4">조회</th>
                  <th className="py-2 pr-4">시식</th>
                  <th className="py-2">구매</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.listings.map((l) => (
                  <tr key={l.id} className="border-b dark:border-slate-700">
                    <td className="py-2 pr-4 font-medium">{l.title}</td>
                    <td className="py-2 pr-4">{l.view_count}</td>
                    <td className="py-2 pr-4">{l.trial_count}</td>
                    <td className="py-2 pr-4">{l.purchase_count}</td>
                    <td className="py-2">
                      {l.purchase_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 dark:text-slate-500 text-sm">등록된 리스팅이 없습니다.</p>
        )}
      </section>

      {/* Settlements */}
      <section>
        <h2 className="font-semibold text-lg mb-3 dark:text-white">정산 내역</h2>
        {settlements.length > 0 ? (
          <div className="space-y-2">
            {settlements.map((s) => (
              <div
                key={s.month}
                className="flex items-center justify-between border dark:border-slate-700 rounded-lg p-3 dark:bg-slate-900"
              >
                <div>
                  <p className="font-medium">{s.month}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {s.count}건 · ₩{s.total.toLocaleString()}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-green-600">정산 ₩{s.settled.toLocaleString()}</p>
                  {s.unsettled > 0 && (
                    <p className="text-yellow-600">미정산 ₩{s.unsettled.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 dark:text-slate-500 text-sm">정산 내역이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
