"use client";

import TrialChat from "@/components/trial-chat";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ListingDetail {
  id: string;
  persona_id: string;
  seller_id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  price_krw: number;
  is_free: boolean;
  view_count: number;
  trial_count: number;
  purchase_count: number;
  rating_avg: number | null;
  quality_score: {
    eligible: boolean;
    interview_done: boolean;
    has_knowledge: boolean;
    principles_count: number;
    scenarios_count: number;
    verification_level?: string;
  } | null;
  status: string;
  personas: {
    name: string;
    domain: string | null;
    description: string | null;
  } | null;
}

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/store/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setListing(data);
      } catch {
        router.push("/store");
        return;
      }

      // Check current user
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          // Check if already purchased
          const { data: purchase } = await supabase
            .from("purchases")
            .select("id")
            .eq("buyer_id", user.id)
            .eq("listing_id", id)
            .eq("status", "confirmed")
            .maybeSingle();
          if (purchase) setPurchased(true);
        }
      } catch {
        // not logged in
      }

      setLoading(false);
    }
    load();
  }, [id, router]);

  if (loading) return <p className="text-gray-500">로딩 중...</p>;
  if (!listing) return null;

  const isOwner = currentUserId === listing.seller_id;
  const personaName = listing.personas?.name ?? listing.title;
  const qualityScore = listing.quality_score;
  const isVerified = qualityScore?.verification_level === "verified";

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            {isVerified ? (
              <span className="shrink-0 text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">
                검증된 페르소나
              </span>
            ) : (
              <span className="shrink-0 text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                기본 페르소나
              </span>
            )}
          </div>
          {listing.subtitle && (
            <p className="text-gray-500 mt-1">{listing.subtitle}</p>
          )}
          {!isVerified && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              이 페르소나는 인터뷰 기반으로 생성되었으며, 실제 전문가의 음성/문서로 검증되지 않았습니다.
            </p>
          )}
        </div>

        {listing.category && (
          <span className="inline-block text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded mb-4">
            {listing.category}
          </span>
        )}

        {listing.tags && listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {listing.tags.map((tag, i) => (
              <span
                key={i}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {listing.description && (
          <section className="mb-6">
            <h2 className="font-semibold text-lg mb-2">설명</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {listing.description}
            </p>
          </section>
        )}

        {/* Quality indicators */}
        {qualityScore && (
          <section className="mb-6">
            <h2 className="font-semibold text-lg mb-2">품질 지표</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <p className="text-sm text-gray-500">판단 원칙</p>
                <p className="font-semibold">
                  {qualityScore.principles_count}개
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-sm text-gray-500">의사결정 시나리오</p>
                <p className="font-semibold">
                  {qualityScore.scenarios_count}개
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Stats */}
        <div className="flex gap-4 text-sm text-gray-500 mb-6">
          <span>조회 {listing.view_count}</span>
          <span>시식 {listing.trial_count}</span>
          <span>구매 {listing.purchase_count}</span>
          {listing.rating_avg !== null && (
            <span>★ {listing.rating_avg.toFixed(1)}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {isOwner && (
            <Link
              href={`/store/${id}`}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              수정하기
            </Link>
          )}
          {purchased && (
            <Link
              href={`/personas/${listing.persona_id}/chat`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              대화하기
            </Link>
          )}
          {!isOwner && !purchased && (
            <Link
              href={`/store/${id}/purchase`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {listing.is_free
                ? "무료로 받기"
                : `₩${listing.price_krw?.toLocaleString()} 구매하기`}
            </Link>
          )}
        </div>
      </div>

      {/* Sidebar: Trial Chat */}
      <div className="lg:w-[380px] shrink-0">
        <div className="border rounded-lg p-4 sticky top-24 h-[500px]">
          <TrialChat listingId={id} personaName={personaName} />
        </div>
      </div>
    </div>
  );
}
