"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface PurchaseInfo {
  orderId: string;
  amount: number;
  orderName: string;
  clientKey: string;
}

export default function PurchasePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<{
    title: string;
    price_krw: number;
    is_free: boolean;
    persona_id: string;
    personas: { name: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/store/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setListing)
      .catch(() => router.push("/store"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handlePurchase() {
    setPurchasing(true);
    setError(null);

    try {
      const res = await fetch(`/api/store/${id}/purchase`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Already purchased, redirect to chat
          router.push(`/personas/${listing?.persona_id}/chat`);
          return;
        }
        setError(data.error || "구매 중 오류가 발생했습니다.");
        setPurchasing(false);
        return;
      }

      const purchaseInfo: PurchaseInfo = data;

      // Phase 1: Toss SDK integration placeholder
      // For now, if amount is 0 (free), complete immediately
      if (purchaseInfo.amount === 0) {
        router.push(`/personas/${listing?.persona_id}/chat`);
        return;
      }

      // TODO: Integrate Toss Payments SDK
      // For paid items, show "준비 중" for now
      setError("결제 시스템 준비 중입니다. 곧 서비스될 예정입니다.");
      setPurchasing(false);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setPurchasing(false);
    }
  }

  if (loading) return <p className="text-gray-500">로딩 중...</p>;
  if (!listing) return null;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">구매 확인</h1>

      <div className="border rounded-lg p-6 mb-6">
        <h2 className="font-semibold text-lg mb-1">{listing.title}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {listing.personas?.name ?? "페르소나"}
        </p>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">결제 금액</span>
            <span className="text-xl font-bold">
              {listing.is_free
                ? "무료"
                : `₩${listing.price_krw?.toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        onClick={handlePurchase}
        disabled={purchasing}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {purchasing
          ? "처리 중..."
          : listing.is_free
            ? "무료로 받기"
            : "결제하기"}
      </button>

      <button
        onClick={() => router.back()}
        className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
      >
        돌아가기
      </button>
    </div>
  );
}
