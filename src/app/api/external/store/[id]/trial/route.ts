import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { chat } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { searchChunks, formatContext } from "@/lib/retriever";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_TRIAL_MESSAGES = 2;

// POST /api/external/store/[id]/trial — API 키 인증 스토어 체험
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

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

  const { message } = await request.json();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // 리스팅 조회
  const { data: listing } = await supabase
    .from("store_listings")
    .select("*")
    .eq("id", listingId)
    .eq("status", "active")
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // 체험 세션 확인/생성
  const today = new Date().toISOString().slice(0, 10);
  const { data: session } = await supabase
    .from("trial_sessions")
    .select("*")
    .eq("user_id", keyRecord.user_id)
    .eq("listing_id", listingId)
    .eq("trial_date", today)
    .single();

  if (session && session.messages_today >= MAX_TRIAL_MESSAGES) {
    return NextResponse.json(
      {
        error: "Trial limit reached",
        messages_remaining: 0,
        disclaimer: "오늘의 체험 횟수를 모두 사용했습니다. 구매 후 무제한 대화가 가능합니다.",
      },
      { status: 429 }
    );
  }

  // 페르소나 조회
  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("id", listing.persona_id)
    .single();

  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  // RAG 검색 + LLM 호출
  const results = await searchChunks(listing.persona_id, message, 5);
  const context = formatContext(results);
  const systemPrompt = buildSystemPrompt(persona as Persona, context);
  const response = await chat(systemPrompt, [
    { role: "user", content: message },
  ]);

  // 세션 업데이트/생성
  const newCount = (session?.messages_today ?? 0) + 1;
  if (session) {
    await supabase
      .from("trial_sessions")
      .update({
        messages_today: newCount,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", session.id);
  } else {
    await supabase.from("trial_sessions").insert({
      listing_id: listingId,
      user_id: keyRecord.user_id,
      messages_today: 1,
      last_message_at: new Date().toISOString(),
      trial_date: today,
    });
  }

  // trial_count 증가
  await supabase
    .from("store_listings")
    .update({ trial_count: (listing.trial_count || 0) + 1 })
    .eq("id", listingId);

  return NextResponse.json({
    response,
    messages_remaining: MAX_TRIAL_MESSAGES - newCount,
    disclaimer:
      "이것은 체험 버전입니다. 전체 기능은 구매 후 이용 가능합니다.",
  });
}
