import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/store — 스토어 목록 검색 (공개)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || null;
  const category = searchParams.get("category") || null;
  const sort = searchParams.get("sort") || "newest";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  const supabase = createServiceClient();

  const { data: listings, error } = await supabase.rpc("search_store_listings", {
    search_query: q,
    filter_category: category,
    sort_by: sort,
    page_limit: limit,
    page_offset: offset,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    listings: listings ?? [],
    total: listings?.length ?? 0,
    page,
    limit,
  });
}
