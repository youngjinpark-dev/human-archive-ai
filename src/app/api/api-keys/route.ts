import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-key";
import { NextResponse } from "next/server";

// GET /api/api-keys — 목록
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, key_prefix, owner, allowed_personas, active, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/api-keys — 생성
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { owner, allowed_personas } = body;

  if (!owner) {
    return NextResponse.json({ error: "owner required" }, { status: 400 });
  }

  const { raw, hash, prefix } = generateApiKey();

  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    key_hash: hash,
    key_prefix: prefix,
    owner,
    allowed_personas: allowed_personas ?? [],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // raw 키는 이때만 반환 (이후 조회 불가)
  return NextResponse.json({ api_key: raw, prefix }, { status: 201 });
}

// DELETE /api/api-keys — 폐기
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get("id");

  if (!keyId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("api_keys")
    .update({ active: false })
    .eq("id", keyId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
