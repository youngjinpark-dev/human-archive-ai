"use client";

import StoreCard from "@/components/store-card";
import type { StoreListing } from "@/components/store-card";
import { STORE_CATEGORIES } from "@/lib/store-constants";
import { useCallback, useEffect, useState } from "react";

export default function StorePage() {
  const [listings, setListings] = useState<StoreListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchListings = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      params.set("sort", sort);
      params.set("page", String(pageNum));

      try {
        const res = await fetch(`/api/store?${params}`);
        const data = await res.json();
        const items: StoreListing[] = data.listings ?? [];
        setListings((prev) => (append ? [...prev, ...items] : items));
        setHasMore(items.length >= (data.limit ?? 20));
      } catch {
        // ignore
      }
      setLoading(false);
    },
    [query, category, sort]
  );

  useEffect(() => {
    setPage(1);
    fetchListings(1, false);
  }, [fetchListings]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchListings(nextPage, true);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchListings(1, false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 dark:text-white">페르소나 스토어</h1>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="페르소나 검색..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white"
          />
        </div>
      </form>

      {/* 카테고리 필터 + 정렬 */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setCategory(null)}
          className={`px-3 py-1 rounded-full text-sm transition ${
            category === null
              ? "bg-blue-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          전체
        </button>
        {STORE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full text-sm transition ${
              category === cat
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {cat}
          </button>
        ))}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none dark:bg-slate-800 dark:text-white"
        >
          <option value="newest">최신순</option>
          <option value="popular">인기순</option>
          <option value="rating">평점순</option>
        </select>
      </div>

      {/* 리스팅 그리드 */}
      {loading && listings.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">로딩 중...</p>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg">등록된 페르소나가 없습니다</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <StoreCard key={l.id} listing={l} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {loading ? "로딩 중..." : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
