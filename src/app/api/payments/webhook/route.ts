import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/payments/webhook — Toss 웹훅 수신
export async function POST(request: Request) {
  const body = await request.json();
  const { paymentKey, status: eventStatus } = body;

  if (!paymentKey) {
    return NextResponse.json({ error: "paymentKey required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: purchase } = await supabase
    .from("purchases")
    .select("*")
    .eq("toss_payment_key", paymentKey)
    .single();

  if (!purchase) {
    // 아직 결제 승인 전이면 무시
    return NextResponse.json({ ok: true });
  }

  // 이벤트별 처리 (멱등성)
  if (eventStatus === "DONE" && purchase.status !== "confirmed") {
    await supabase
      .from("purchases")
      .update({ status: "confirmed" })
      .eq("id", purchase.id);
  } else if (eventStatus === "CANCELED" && purchase.status !== "cancelled") {
    await supabase
      .from("purchases")
      .update({ status: "cancelled" })
      .eq("id", purchase.id);
  }

  return NextResponse.json({ ok: true });
}
