import { createClient, createServiceClient } from "@/lib/supabase/server";
import { STORE_CATEGORIES, HIGH_RISK_CATEGORIES } from "@/lib/store-constants";
import { NextResponse } from "next/server";

// POST /api/store/register — 페르소나를 스토어에 등록
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { persona_id, title, subtitle, description, category, tags } = body;

  if (!persona_id || !title || !description || !category) {
    return NextResponse.json(
      { error: "persona_id, title, description, category are required" },
      { status: 400 }
    );
  }

  // 카테고리 유효성 검사
  if (!(STORE_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // 고위험 카테고리 차단
  if ((HIGH_RISK_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json(
      { error: "High-risk categories are not allowed" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // 페르소나 소유자 확인
  const { data: persona } = await serviceClient
    .from("personas")
    .select("id, user_id")
    .eq("id", persona_id)
    .single();

  if (!persona || persona.user_id !== user.id) {
    return NextResponse.json({ error: "Persona not found or not owned" }, { status: 403 });
  }

  // 품질 게이트 확인
  const { data: qualityResult, error: qualityError } = await serviceClient.rpc(
    "check_quality_gate",
    { target_persona_id: persona_id }
  );

  if (qualityError) {
    return NextResponse.json({ error: qualityError.message }, { status: 500 });
  }

  if (!qualityResult?.eligible) {
    return NextResponse.json(
      {
        error: "Persona does not meet quality requirements",
        quality: qualityResult,
      },
      { status: 400 }
    );
  }

  // 스토어 등록
  const { data: listing, error } = await serviceClient
    .from("store_listings")
    .insert({
      persona_id,
      seller_id: user.id,
      title,
      subtitle: subtitle ?? null,
      description,
      category,
      tags: tags ?? [],
      quality_score: qualityResult,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(listing, { status: 201 });
}
