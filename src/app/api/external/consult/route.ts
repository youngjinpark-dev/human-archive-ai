import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { chat } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { loadFramework } from "@/lib/framework-loader";
import { embedText } from "@/lib/embedding";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 120;

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
  let frameworkData;
  try {
    frameworkData = await loadFramework(persona_id);
  } catch {
    return NextResponse.json(
      { error: "Failed to load framework" },
      { status: 500 }
    );
  }
  if (!frameworkData || frameworkData.framework.status !== "ready") {
    return NextResponse.json(
      { error: "Judgment framework not ready. Complete a deep interview first." },
      { status: 400 }
    );
  }

  // 임베딩 1회만 수행 후 RAG + 스토리 검색 모두 활용
  let ragContext = "(관련 자료 없음)";
  let similarStories: { title: string; summary: string; decision: string }[] | null = null;

  try {
    const queryEmbedding = await embedText(situation);

    // RAG + 스토리 검색 병렬 실행 (같은 임베딩 재사용)
    const [{ data: ragData }, { data: storyData }] = await Promise.all([
      supabase.rpc("match_chunks", {
        query_embedding: queryEmbedding,
        target_persona_id: persona_id,
        match_count: 5,
      }),
      supabase.rpc("match_stories", {
        query_embedding: queryEmbedding,
        target_framework_id: frameworkData.framework.id,
        match_count: 3,
      }),
    ]);

    if (ragData && ragData.length > 0) {
      ragContext = ragData
        .map((r: { content: string; metadata?: { source?: string } }, i: number) => {
          const source = r.metadata?.source ?? "참고자료";
          return `[${i + 1}] (${source})\n${r.content}`;
        })
        .join("\n\n");
    }
    similarStories = storyData;
  } catch {
    // 임베딩/검색 실패 시 무시 — 프레임워크 데이터만으로 응답
  }

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

  // LLM으로 판단 생성 (1회 호출로 완료)
  try {
    const consultPrompt = `상황: ${situation}${contextText}${constraintsText}${storiesContext}

이 상황에 대해 판단 프레임워크를 기반으로 자문을 제공하세요.
가능하면 아래 JSON 형식으로 응답하되, 불가능하면 자유 형식도 괜찮습니다:
{
  "judgment": "판단 결론",
  "reasoning": "판단 근거 (프레임워크 기반)",
  "applicable_axes": [{"name": "축 이름", "weight": 0.8}],
  "relevant_patterns": [{"condition": "조건", "action": "행동"}],
  "similar_story": {"title": "스토리 제목", "summary": "요약", "decision": "판단"} 또는 null,
  "confidence": 0.85,
  "caveats": ["주의사항1", "주의사항2"]
}`;

    const response = await chat(systemPrompt, [
      { role: "user", content: consultPrompt },
    ]);

    // JSON 파싱 시도
    const braceStart = response.indexOf("{");
    const braceEnd = response.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      try {
        const parsed = JSON.parse(response.slice(braceStart, braceEnd + 1)) as ConsultResult;
        return NextResponse.json(parsed);
      } catch {
        // JSON 파싱 실패 → 비구조화 응답으로 반환
      }
    }

    return NextResponse.json({
      judgment: response,
      reasoning: "",
      applicable_axes: [],
      relevant_patterns: [],
      confidence: 0.5,
      caveats: ["구조화된 분석에 실패하여 일반 응답으로 대체되었습니다."],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "LLM error";
    return NextResponse.json(
      { error: `Judgment generation failed: ${msg}` },
      { status: 500 }
    );
  }
}
