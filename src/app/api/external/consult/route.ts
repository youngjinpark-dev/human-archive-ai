import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { chat } from "@/lib/llm";
import { extract } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { searchChunks, formatContext } from "@/lib/retriever";
import { loadFramework } from "@/lib/framework-loader";
import { embedText } from "@/lib/embedding";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

interface ConsultResult {
  judgment: string;
  reasoning: string;
  applicable_axes: { name: string; weight: number }[];
  relevant_patterns: { condition: string; action: string }[];
  similar_story?: { title: string; summary: string; decision: string };
  confidence: number;
  caveats: string[];
}

// POST /api/external/consult — 판단 자문
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { persona_id, situation, context: userContext, constraints } = body;

  if (!persona_id || !situation) {
    return NextResponse.json(
      { error: "persona_id and situation required" },
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

  // 프레임워크 로드
  const frameworkData = await loadFramework(persona_id);
  if (!frameworkData || frameworkData.framework.status !== "ready") {
    return NextResponse.json(
      { error: "Judgment framework not ready. Complete a deep interview first." },
      { status: 400 }
    );
  }

  // RAG 검색
  const ragResults = await searchChunks(persona_id, situation, 5);
  const ragContext = formatContext(ragResults);

  // 경험 스토리 유사도 검색
  const queryEmbedding = await embedText(situation);
  const { data: similarStories } = await supabase.rpc("match_stories", {
    query_embedding: queryEmbedding,
    target_framework_id: frameworkData.framework.id,
    match_count: 3,
  });

  // 시스템 프롬프트 구성
  const systemPrompt = buildSystemPrompt(
    persona as Persona,
    ragContext,
    frameworkData
  );

  // 스토리 컨텍스트
  const storiesContext =
    similarStories && similarStories.length > 0
      ? "\n\n## 관련 경험 스토리\n" +
        similarStories
          .map(
            (s: { title: string; summary: string; decision: string }) =>
              `- ${s.title}: ${s.summary} → 판단: ${s.decision}`
          )
          .join("\n")
      : "";

  // 제약 조건 텍스트
  const constraintsText =
    constraints && constraints.length > 0
      ? `\n제약 조건: ${constraints.join(", ")}`
      : "";

  const contextText = userContext
    ? `\n추가 컨텍스트: ${JSON.stringify(userContext)}`
    : "";

  // LLM으로 구조화된 판단 생성
  const consultPrompt = `다음 상황에 대해 판단 프레임워크를 기반으로 구조화된 자문을 제공하세요.

상황: ${situation}${contextText}${constraintsText}${storiesContext}

반드시 JSON으로만 응답하세요:
{
  "judgment": "판단 결론",
  "reasoning": "판단 근거 (프레임워크 기반)",
  "applicable_axes": [{"name": "축 이름", "weight": 0.8}],
  "relevant_patterns": [{"condition": "조건", "action": "행동"}],
  "similar_story": {"title": "스토리 제목", "summary": "요약", "decision": "판단"} 또는 null,
  "confidence": 0.85,
  "caveats": ["주의사항1", "주의사항2"]
}`;

  const result = await extract<ConsultResult>(consultPrompt, systemPrompt);

  if (!result) {
    // fallback: 비구조화 응답
    const response = await chat(systemPrompt, [
      { role: "user", content: `상황: ${situation}${contextText}${constraintsText}\n\n이 상황에 대해 판단 프레임워크를 기반으로 조언해주세요.` },
    ]);
    return NextResponse.json({
      judgment: response,
      reasoning: "",
      applicable_axes: [],
      relevant_patterns: [],
      confidence: 0.5,
      caveats: ["구조화된 분석에 실패하여 일반 응답으로 대체되었습니다."],
    });
  }

  return NextResponse.json(result);
}
