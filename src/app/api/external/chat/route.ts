import { createServiceClient } from "@/lib/supabase/server";
import { chat } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { searchChunks, formatContext } from "@/lib/retriever";
import { loadFramework } from "@/lib/framework-loader";
import { hashApiKey } from "@/lib/api-key";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// POST /api/external/chat — API 키 인증 외부 채팅
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { persona_id, message } = body;
  if (!persona_id || !message) {
    return NextResponse.json(
      { error: "persona_id and message required" },
      { status: 400 }
    );
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

  // 페르소나 접근 권한 확인
  if (
    keyRecord.allowed_personas.length > 0 &&
    !keyRecord.allowed_personas.includes(persona_id)
  ) {
    return NextResponse.json(
      { error: "Not authorized for this persona" },
      { status: 403 }
    );
  }

  // 페르소나 조회
  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("id", persona_id)
    .single();
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  // RAG 검색
  const results = await searchChunks(persona_id, message, 5);
  const context = formatContext(results);

  // 프레임워크 로드 (있으면 프레임워크 기반, 없으면 기존 방식)
  const frameworkData = await loadFramework(persona_id);

  // 시스템 프롬프트
  const systemPrompt = buildSystemPrompt(
    persona as Persona,
    context,
    frameworkData ?? undefined
  );

  // LLM 호출
  const response = await chat(systemPrompt, [
    { role: "user", content: message },
  ]);

  return NextResponse.json({ response, persona_id });
}
