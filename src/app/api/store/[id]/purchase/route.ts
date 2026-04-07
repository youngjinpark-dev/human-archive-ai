import { createClient } from "@/lib/supabase/server";
import { generateOrderId } from "@/lib/toss";
import { NextResponse } from "next/server";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;

// POST /api/store/[id]/purchase — 구매 시작 (orderId 생성)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 리스팅 조회
  const { data: listing, error: listingError } = await supabase
    .from("store_listings")
    .select("*")
    .eq("id", listingId)
    .eq("status", "active")
    .single();

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // 자기 리스팅 구매 불가
  if (listing.seller_id === user.id) {
    return NextResponse.json(
      { error: "Cannot purchase your own listing" },
      { status: 400 }
    );
  }

  // 이미 구매한 경우
  const { data: existingPurchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("listing_id", listingId)
    .eq("status", "confirmed")
    .single();

  if (existingPurchase) {
    return NextResponse.json(
      { error: "Already purchased" },
      { status: 409 }
    );
  }

  const orderId = generateOrderId();
  const sellerAmount = Math.floor(
    listing.price_krw * (listing.revenue_split_seller / 100)
  );
  const platformAmount = listing.price_krw - sellerAmount;

  // 구매 레코드 생성
  const { error: insertError } = await supabase.from("purchases").insert({
    buyer_id: user.id,
    listing_id: listingId,
    persona_id: listing.persona_id,
    seller_id: listing.seller_id,
    amount_krw: listing.price_krw,
    toss_order_id: orderId,
    status: "pending",
    seller_amount: sellerAmount,
    platform_amount: platformAmount,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    orderId,
    amount: listing.price_krw,
    orderName: listing.title,
    clientKey: TOSS_CLIENT_KEY,
  });
}
