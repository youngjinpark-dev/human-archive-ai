import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/store/invite — 초대 코드 검증
export async function POST(request: Request) {
  const body = await request.json();
  const { code } = body;

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: invite } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .is("used_by", null)
    .single();

  if (!invite) {
    return NextResponse.json({ valid: false });
  }

  // 만료 확인
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true });
}
