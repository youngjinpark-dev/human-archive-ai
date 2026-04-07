import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/personas/[id]/framework — 프레임워크 조회
export async function GET(
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

  // 페르소나 접근 권한 확인 (소유자 또는 구매자)
  const { data: persona } = await serviceClient
    .from("personas")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = persona.user_id === user.id;
  if (!isOwner) {
    const { data: purchase } = await serviceClient
      .from("purchases")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("persona_id", id)
      .eq("status", "confirmed")
      .single();
    if (!purchase) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: framework } = await serviceClient
    .from("judgment_frameworks")
    .select("*")
    .eq("persona_id", id)
    .single();

  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  const [{ data: axes }, { data: patterns }, { data: stories }] = await Promise.all([
    serviceClient
      .from("judgment_axes")
      .select("*")
      .eq("framework_id", framework.id)
      .order("weight", { ascending: false }),
    serviceClient
      .from("if_then_patterns")
      .select("*")
      .eq("framework_id", framework.id)
      .order("confidence", { ascending: false }),
    serviceClient
      .from("experience_stories")
      .select("id, title, summary, context, decision, outcome, lesson, related_axes, source_type, created_at")
      .eq("framework_id", framework.id)
      .order("created_at", { ascending: false }),
  ]);

  // 품질 게이트 정보
  const { data: quality } = await serviceClient.rpc("check_quality_gate_v2", {
    target_persona_id: id,
  });

  return NextResponse.json({
    framework,
    axes: axes ?? [],
    patterns: patterns ?? [],
    stories: stories ?? [],
    quality: quality ?? null,
  });
}

// PATCH /api/personas/[id]/framework — 프레임워크 수정 (소유자 전용)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createServiceClient();

  const { data: persona } = await serviceClient
    .from("personas")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (!persona || persona.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: framework } = await serviceClient
    .from("judgment_frameworks")
    .select("*")
    .eq("persona_id", id)
    .single();
  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  const body = await request.json();

  // 프레임워크 기본 정보 업데이트
  const fwUpdates: Record<string, unknown> = {};
  if (body.philosophy !== undefined) fwUpdates.philosophy = body.philosophy;
  if (body.domains !== undefined) fwUpdates.domains = body.domains;
  if (Object.keys(fwUpdates).length > 0) {
    fwUpdates.version = (framework.version ?? 1) + 1;
    await serviceClient
      .from("judgment_frameworks")
      .update(fwUpdates)
      .eq("id", framework.id);
  }

  // 축 추가/수정
  if (body.axes && Array.isArray(body.axes)) {
    for (const axis of body.axes) {
      if (axis.id) {
        await serviceClient
          .from("judgment_axes")
          .update({
            name: axis.name,
            weight: axis.weight,
            description: axis.description ?? null,
          })
          .eq("id", axis.id)
          .eq("framework_id", framework.id);
      } else {
        await serviceClient.from("judgment_axes").insert({
          framework_id: framework.id,
          name: axis.name,
          weight: axis.weight ?? 0.5,
          description: axis.description ?? null,
        });
      }
    }
  }

  // 패턴 추가/수정
  if (body.patterns && Array.isArray(body.patterns)) {
    for (const pattern of body.patterns) {
      if (pattern.id) {
        await serviceClient
          .from("if_then_patterns")
          .update({
            condition: pattern.condition,
            action: pattern.action,
            reasoning: pattern.reasoning ?? null,
          })
          .eq("id", pattern.id)
          .eq("framework_id", framework.id);
      } else {
        await serviceClient.from("if_then_patterns").insert({
          framework_id: framework.id,
          condition: pattern.condition,
          action: pattern.action,
          reasoning: pattern.reasoning ?? null,
          confidence: 0.5,
          source_type: "manual",
        });
      }
    }
  }

  return NextResponse.json({ success: true, framework_id: framework.id });
}
