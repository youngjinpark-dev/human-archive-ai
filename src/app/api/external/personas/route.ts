import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { NextResponse } from "next/server";

// GET /api/external/personas — API 키로 접근 가능한 페르소나 목록 조회
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

  // 페르소나 조회: allowed_personas가 비어있으면 해당 유저의 전체 페르소나 반환
  let query = supabase
    .from("personas")
    .select("id, name, domain, description, created_at")
    .eq("user_id", keyRecord.user_id)
    .order("created_at", { ascending: false });

  if (keyRecord.allowed_personas.length > 0) {
    query = query.in("id", keyRecord.allowed_personas);
  }

  const { data: personas, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ personas });
}
