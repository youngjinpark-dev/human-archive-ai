import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/purchases — 내 구매 목록
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: purchases, error } = await supabase
    .from("purchases")
    .select(
      `
      id,
      amount_krw,
      status,
      created_at,
      listing:store_listings (
        id,
        title,
        subtitle,
        category,
        thumbnail_url
      ),
      persona:personas (
        id,
        name,
        domain,
        description
      )
    `
    )
    .eq("buyer_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purchases: purchases ?? [] });
}
