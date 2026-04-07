import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { confirmPayment } from "@/lib/toss";
import { NextResponse } from "next/server";

// POST /api/payments/confirm — Toss 결제 승인
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentKey, orderId, amount } = await request.json();
  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json(
      { error: "paymentKey, orderId, amount required" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // 구매 레코드 조회
  const { data: purchase, error: findError } = await serviceClient
    .from("purchases")
    .select("*")
    .eq("toss_order_id", orderId)
    .eq("buyer_id", user.id)
    .single();

  if (findError || !purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // 금액 검증
  if (purchase.amount_krw !== amount) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  // Toss 결제 승인
  const tossResult = await confirmPayment(paymentKey, orderId, amount);

  if (tossResult.status === "DONE") {
    // 성공: 구매 상태 업데이트
    await serviceClient
      .from("purchases")
      .update({
        status: "confirmed",
        toss_payment_key: paymentKey,
        payment_method: tossResult.method,
      })
      .eq("id", purchase.id);

    // purchase_count 증가
    const { data: listing } = await serviceClient
      .from("store_listings")
      .select("purchase_count")
      .eq("id", purchase.listing_id)
      .single();
    if (listing) {
      await serviceClient
        .from("store_listings")
        .update({ purchase_count: (listing.purchase_count || 0) + 1 })
        .eq("id", purchase.listing_id);
    }

    return NextResponse.json({
      success: true,
      purchase_id: purchase.id,
    });
  } else {
    // 실패: 상태 업데이트
    await serviceClient
      .from("purchases")
      .update({ status: "failed" })
      .eq("id", purchase.id);

    return NextResponse.json(
      {
        success: false,
        error: tossResult.message || "Payment failed",
      },
      { status: 400 }
    );
  }
}
