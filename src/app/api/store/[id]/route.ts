import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/store/[id] — 스토어 상세 조회 (공개)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  // 리스팅 조회
  const { data: listing, error } = await supabase
    .from("store_listings")
    .select("*, personas(name, domain, description)")
    .eq("id", id)
    .single();

  if (error || !listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 조회수 증가
  await supabase
    .from("store_listings")
    .update({ view_count: (listing.view_count ?? 0) + 1 })
    .eq("id", id);

  return NextResponse.json(listing);
}

// PUT /api/store/[id] — 리스팅 수정 (소유자만)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 소유자 확인
  const serviceClient = createServiceClient();
  const { data: listing } = await serviceClient
    .from("store_listings")
    .select("seller_id")
    .eq("id", id)
    .single();

  if (!listing || listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, subtitle, description, category, tags, price_krw, is_free } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (subtitle !== undefined) updates.subtitle = subtitle;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (tags !== undefined) updates.tags = tags;
  if (price_krw !== undefined) updates.price_krw = price_krw;
  if (is_free !== undefined) updates.is_free = is_free;

  const { data, error } = await serviceClient
    .from("store_listings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/store/[id] — 리스팅 아카이브 (소유자만)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createServiceClient();
  const { data: listing } = await serviceClient
    .from("store_listings")
    .select("seller_id")
    .eq("id", id)
    .single();

  if (!listing || listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await serviceClient
    .from("store_listings")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
