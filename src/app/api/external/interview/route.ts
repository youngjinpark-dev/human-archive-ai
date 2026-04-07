import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { extract } from "@/lib/llm";
import {
  INTERVIEW_PHASES,
  getQuestion,
  getNextPosition,
} from "@/lib/interview-phases";
import type { DecisionScenario } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// POST /api/external/interview — API 키로 인터뷰 진행
// action: "start" | "answer"
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { persona_id, action, session_id, answer } = body;

  if (!persona_id || !action) {
    return NextResponse.json(
      { error: "persona_id and action required" },
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

  // 페르소나 소유 확인
  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("id", persona_id)
    .eq("user_id", keyRecord.user_id)
    .single();

  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  // ── START ──
  if (action === "start") {
    // 기존 미완료 세션 확인
    const { data: existing } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("persona_id", persona_id)
      .eq("completed", false)
      .single();

    if (existing) {
      const question = getQuestion(existing.phase_index, existing.question_index);
      return NextResponse.json({
        session_id: existing.id,
        question,
        phase: INTERVIEW_PHASES[existing.phase_index].name,
        phase_index: existing.phase_index,
        question_index: existing.question_index,
        completed: false,
      });
    }

    const { data: session, error } = await supabase
      .from("interview_sessions")
      .insert({ persona_id })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const question = getQuestion(0, 0);
    return NextResponse.json({
      session_id: session.id,
      question,
      phase: INTERVIEW_PHASES[0].name,
      phase_index: 0,
      question_index: 0,
      completed: false,
    });
  }

  // ── ANSWER ──
  if (action === "answer") {
    if (!session_id || !answer) {
      return NextResponse.json(
        { error: "session_id and answer required for action 'answer'" },
        { status: 400 }
      );
    }

    const { data: session } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (!session || session.completed) {
      return NextResponse.json(
        { error: "Invalid or completed session" },
        { status: 400 }
      );
    }

    const phase = INTERVIEW_PHASES[session.phase_index];
    const question = getQuestion(session.phase_index, session.question_index);

    // 답변 저장
    await supabase.from("interview_answers").insert({
      session_id,
      phase: phase.name,
      question: question ?? "",
      answer,
    });

    // 답변을 페르소나에 반영
    await processAnswer(supabase, persona_id, phase.name, answer);

    // 다음 질문으로 이동
    const nextPos = getNextPosition(session.phase_index, session.question_index);

    if (nextPos) {
      await supabase
        .from("interview_sessions")
        .update({
          phase_index: nextPos.phaseIndex,
          question_index: nextPos.questionIndex,
        })
        .eq("id", session_id);

      const nextQuestion = getQuestion(nextPos.phaseIndex, nextPos.questionIndex);
      return NextResponse.json({
        status: "in_progress",
        phase: INTERVIEW_PHASES[nextPos.phaseIndex].name,
        next_question: nextQuestion,
        completed: false,
      });
    }

    // 인터뷰 완료
    await supabase
      .from("interview_sessions")
      .update({ completed: true })
      .eq("id", session_id);

    return NextResponse.json({
      status: "completed",
      phase: phase.name,
      next_question: null,
      completed: true,
    });
  }

  return NextResponse.json(
    { error: "action must be 'start' or 'answer'" },
    { status: 400 }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processAnswer(
  supabase: any,
  personaId: string,
  phaseName: string,
  answer: string
) {
  if (phaseName === "domain") {
    const { data: persona } = await supabase
      .from("personas")
      .select("domain")
      .eq("id", personaId)
      .single();
    const newDomain = persona?.domain
      ? `${persona.domain} | ${answer.trim()}`
      : answer.trim();
    await supabase.from("personas").update({ domain: newDomain }).eq("id", personaId);
  } else if (phaseName === "principles") {
    const extracted = await extract<string[]>(
      answer,
      '이 텍스트에서 판단 원칙이나 조언을 리스트로 추출해줘. JSON 배열 형태로만 응답해. 예: ["원칙1", "원칙2"]'
    );
    const principles = extracted ?? [answer.trim()];
    const { data: persona } = await supabase
      .from("personas")
      .select("principles")
      .eq("id", personaId)
      .single();
    const existing = persona?.principles ?? [];
    await supabase
      .from("personas")
      .update({ principles: [...existing, ...principles] })
      .eq("id", personaId);
  } else if (phaseName === "scenarios") {
    const extracted = await extract<DecisionScenario>(
      answer,
      '이 텍스트에서 의사결정 시나리오를 추출해. JSON으로만 응답해. 형식: {"situation": "상황", "decision": "판단", "reasoning": "근거"}'
    );
    const scenario = extracted ?? {
      situation: "(인터뷰 답변)",
      decision: answer.trim(),
    };
    const { data: persona } = await supabase
      .from("personas")
      .select("decision_scenarios")
      .eq("id", personaId)
      .single();
    const existing = persona?.decision_scenarios ?? [];
    await supabase
      .from("personas")
      .update({ decision_scenarios: [...existing, scenario] })
      .eq("id", personaId);
  } else if (phaseName === "style") {
    await supabase.from("personas").update({ style: answer.trim() }).eq("id", personaId);
  }
}
