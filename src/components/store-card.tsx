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
  avg_rating: number | null;
  status: string;
  created_at: string;
}

export default function StoreCard({ listing }: { listing: StoreListing }) {
  return (
    <Link
      href={`/store/${listing.id}`}
      className="block border rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition"
    >
      <h3 className="font-semibold text-lg">{listing.title}</h3>
      {listing.subtitle && (
        <p className="text-sm text-gray-500 mt-0.5">{listing.subtitle}</p>
      )}
      {listing.category && (
        <span className="inline-block mt-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
          {listing.category}
        </span>
      )}
      <p className="mt-2 text-xs text-gray-400">by {listing.seller_name}</p>
      <div className="mt-3 flex gap-3 text-xs text-gray-400">
        <span>조회 {listing.view_count}</span>
        <span>시식 {listing.trial_count}</span>
        {listing.avg_rating !== null && (
          <span>★ {listing.avg_rating.toFixed(1)}</span>
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
