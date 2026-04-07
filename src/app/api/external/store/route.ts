import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { NextResponse } from "next/server";

// GET /api/external/store — API 키 인증 스토어 검색
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

  // 쿼리 파라미터
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || undefined;
  const category = searchParams.get("category") || undefined;
  const sort = searchParams.get("sort") || "newest";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = (page - 1) * limit;

  const { data: listings, error } = await supabase.rpc(
    "search_store_listings",
    {
      search_query: q ?? null,
      filter_category: category ?? null,
      sort_by: sort,
      page_limit: limit,
      page_offset: offset,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ listings: listings || [] });
}
