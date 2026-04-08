import Link from "next/link";

export interface StoreListing {
  id: string;
  persona_id: string;
  seller_id: string;
  seller_name: string;
  persona_name: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  price: number;
  view_count: number;
  trial_count: number;
  purchase_count: number;
  rating_avg: number | null;
  quality_score?: { verification_level?: string } | null;
  status: string;
  created_at: string;
}

export default function StoreCard({ listing }: { listing: StoreListing }) {
  const isVerified = listing.quality_score?.verification_level === "verified";

  return (
    <Link
      href={`/store/${listing.id}`}
      className="block border dark:border-slate-700 rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition dark:bg-slate-900"
    >
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-lg dark:text-white">{listing.title}</h3>
        {isVerified ? (
          <span className="shrink-0 text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded" title="음성/문서 기반 검증된 페르소나">
            검증됨
          </span>
        ) : (
          <span className="shrink-0 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded" title="인터뷰 기반 기본 페르소나">
            기본
          </span>
        )}
      </div>
      {listing.subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{listing.subtitle}</p>
      )}
      {listing.category && (
        <span className="inline-block mt-2 text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
          {listing.category}
        </span>
      )}
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">by {listing.seller_name}</p>
      <div className="mt-3 flex gap-3 text-xs text-slate-400 dark:text-slate-500">
        <span>조회 {listing.view_count}</span>
        <span>시식 {listing.trial_count}</span>
        {listing.rating_avg !== null && (
          <span>★ {listing.rating_avg.toFixed(1)}</span>
        )}
      </div>
      <div className="mt-3">
        <span className="inline-block px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium">
          시식하기
        </span>
      </div>
    </Link>
  );
}
