import { createClient, createServiceClient } from "@/lib/supabase/server";
import { chat } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { searchChunks, formatContext } from "@/lib/retriever";
import { TRIAL_LIMITS, DISCLAIMER_TEXT } from "@/lib/store-constants";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// POST /api/store/[id]/trial — 체험 대화 (로그인/비로그인)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const body = await request.json();
  const { message, fingerprint } = body;

  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // 선택적 세션 인증
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // 비로그인 사용자
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const serviceClient = createServiceClient();

  // 리스팅 조회
  const { data: listing } = await serviceClient
    .from("store_listings")
    .select("*, personas(*)")
    .eq("id", listingId)
    .eq("status", "active")
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const persona = listing.personas as unknown as Persona;

  // 체험 세션 조회/생성
  let trialSession;

  if (userId) {
    const { data: existing } = await serviceClient
      .from("trial_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("listing_id", listingId)
      .eq("trial_date", new Date().toISOString().split("T")[0])
      .single();
    trialSession = existing;
  } else {
    const { data: existing } = await serviceClient
      .from("trial_sessions")
      .select("*")
      .eq("ip_address", ip)
      .eq("fingerprint", fingerprint ?? "")
      .eq("listing_id", listingId)
      .eq("trial_date", new Date().toISOString().split("T")[0])
      .is("user_id", null)
      .single();
    trialSession = existing;
  }

  if (!trialSession) {
    // 일일 페르소나 수 제한 확인
    let personasToday: string[] = [];

    if (userId) {
      const { data: todaySessions } = await serviceClient
        .from("trial_sessions")
        .select("personas_today")
        .eq("user_id", userId)
        .eq("trial_date", new Date().toISOString().split("T")[0]);
      personasToday = (todaySessions ?? []).flatMap((s) => s.personas_today ?? []);
    } else {
      const { data: todaySessions } = await serviceClient
        .from("trial_sessions")
        .select("personas_today")
        .eq("ip_address", ip)
        .eq("fingerprint", fingerprint ?? "")
        .eq("trial_date", new Date().toISOString().split("T")[0])
        .is("user_id", null);
      personasToday = (todaySessions ?? []).flatMap((s) => s.personas_today ?? []);
    }

    const uniquePersonas = [...new Set(personasToday)];
    if (
      uniquePersonas.length >= TRIAL_LIMITS.PERSONAS_PER_DAY &&
      !uniquePersonas.includes(listing.persona_id)
    ) {
      return NextResponse.json(
        { error: "Daily persona trial limit reached" },
        { status: 429 }
      );
    }

    // 새 세션 생성
    const { data: newSession } = await serviceClient
      .from("trial_sessions")
      .insert({
        listing_id: listingId,
        user_id: userId,
        ip_address: ip,
        fingerprint: fingerprint ?? null,
        messages_today: 0,
        personas_today: uniquePersonas.includes(listing.persona_id)
          ? uniquePersonas
          : [...uniquePersonas, listing.persona_id],
      })
      .select()
      .single();
    trialSession = newSession;
  }

  if (!trialSession) {
    return NextResponse.json({ error: "Failed to create trial session" }, { status: 500 });
  }

  // 메시지 수 제한 확인
  if (trialSession.messages_today >= TRIAL_LIMITS.MESSAGES_PER_PERSONA) {
    return NextResponse.json(
      {
        error: "Trial message limit reached",
        messages_remaining: 0,
        disclaimer: DISCLAIMER_TEXT,
      },
      { status: 429 }
    );
  }

  // RAG 검색 + 프롬프트 생성
  const results = await searchChunks(listing.persona_id, message, 5);
  const context = formatContext(results);
  const systemPrompt = buildSystemPrompt(persona, context);

  // LLM 응답 생성
  const response = await chat(
    systemPrompt,
    [{ role: "user", content: message }],
    { maxTokens: 2048 }
  );

  // 면책 조항 추가
  const responseWithDisclaimer = `${DISCLAIMER_TEXT}\n\n${response}`;

  // 체험 세션 카운터 업데이트
  const newCount = (trialSession.messages_today ?? 0) + 1;
  await serviceClient
    .from("trial_sessions")
    .update({
      messages_today: newCount,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", trialSession.id);

  // 체험 횟수 증가
  await serviceClient
    .from("store_listings")
    .update({ trial_count: (listing.trial_count ?? 0) + 1 })
    .eq("id", listingId);

  return NextResponse.json({
    response: responseWithDisclaimer,
    messages_remaining: TRIAL_LIMITS.MESSAGES_PER_PERSONA - newCount,
    disclaimer: DISCLAIMER_TEXT,
  });
}
