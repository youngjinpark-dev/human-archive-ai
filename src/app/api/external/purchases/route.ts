import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { NextResponse } from "next/server";

// GET /api/external/purchases — API 키 인증 구매 목록 조회
export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // API 키 검증
  const keyHash = hashApiKey(apiKey);
  const { data: keyRecord } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("active", true)
    .single();

  if (!keyRecord) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const { data: purchases, error } = await supabase
    .from("purchases")
    .select(
      `
      id,
      persona_id,
      amount_krw,
      created_at,
      persona:personas (
        id,
        name,
        domain,
        description
      )
    `
    )
    .eq("buyer_id", keyRecord.user_id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purchases: purchases ?? [] });
}
