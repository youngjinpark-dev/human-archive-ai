import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { chat, extract } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { loadFramework } from "@/lib/framework-loader";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

interface CompareResult {
  recommended: string;
  reasoning: string;
  per_approach: {
    name: string;
    pros: string[];
    cons: string[];
    axes_alignment: Record<string, number>;
    risk_level: "low" | "medium" | "high";
  }[];
  relevant_stories: { title: string; summary: string }[];
}

// POST /api/external/compare — 접근법 비교
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { persona_id, approaches, context: userContext } = body;

  if (!persona_id || !approaches || !Array.isArray(approaches) || approaches.length < 2) {
    return NextResponse.json(
      { error: "persona_id and approaches (array of 2~5) required" },
      { status: 400 }
    );
  }

  if (approaches.length > 5) {
    return NextResponse.json(
      { error: "Maximum 5 approaches allowed" },
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
    return NextResponse.json({ error: "Failed to load framework" }, { status: 500 });
  }
  if (!frameworkData || frameworkData.framework.status !== "ready") {
    return NextResponse.json(
      { error: "Judgment framework not ready" },
      { status: 400 }
    );
  }

  // 시스템 프롬프트 (RAG 없이 프레임워크 기반)
  const systemPrompt = buildSystemPrompt(
    persona as Persona,
    "(관련 자료 없음)",
    frameworkData
  );

  const contextText = userContext ? `\n상황: ${userContext}` : "";

  const comparePrompt = `다음 접근법들을 판단 프레임워크를 기반으로 비교 분석하세요.

접근법: ${approaches.join(", ")}${contextText}

반드시 JSON으로만 응답하세요:
{
  "recommended": "추천 접근법 이름",
  "reasoning": "추천 근거",
  "per_approach": [
    {
      "name": "접근법 이름",
      "pros": ["장점1", "장점2"],
      "cons": ["단점1", "단점2"],
      "axes_alignment": {"축이름": 0.8},
      "risk_level": "low|medium|high"
    }
  ],
  "relevant_stories": [{"title": "관련 경험", "summary": "요약"}]
}`;

  try {
    const result = await extract<CompareResult>(comparePrompt, systemPrompt);

    if (!result) {
      const response = await chat(systemPrompt, [
        { role: "user", content: `접근법 비교: ${approaches.join(" vs ")}${contextText}\n\n판단 프레임워크를 기반으로 비교 분석해주세요.` },
      ]);
      return NextResponse.json({
        recommended: approaches[0],
        reasoning: response,
        per_approach: [],
        relevant_stories: [],
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Analysis error";
    return NextResponse.json({ error: `Compare failed: ${msg}` }, { status: 500 });
  }
}
