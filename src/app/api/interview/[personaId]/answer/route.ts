import { createClient } from "@/lib/supabase/server";
import { extract } from "@/lib/llm";
import {
  INTERVIEW_PHASES,
  getQuestion,
  getNextPosition,
} from "@/lib/interview-phases";
import type { DecisionScenario } from "@/types";
import { NextResponse } from "next/server";

// POST /api/interview/[personaId]/answer — 답변 처리
export async function POST(
  request: Request,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { session_id, answer } = body;

  if (!session_id || !answer) {
    return NextResponse.json(
      { error: "session_id and answer required" },
      { status: 400 }
    );
  }

  // 세션 조회
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", session_id)
    .single();
  if (!session || session.completed) {
    return NextResponse.json({ error: "Invalid or completed session" }, { status: 400 });
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
  await processAnswer(supabase, personaId, phase.name, answer);

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
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processAnswer(
  supabase: any,
  personaId: string,
  phaseName: string,
  answer: string
) {
  const sb = supabase;

  if (phaseName === "domain") {
    const { data: persona } = await sb
      .from("personas")
      .select("domain")
      .eq("id", personaId)
      .single();
    const newDomain = persona?.domain
      ? `${persona.domain} | ${answer.trim()}`
      : answer.trim();
    await sb.from("personas").update({ domain: newDomain }).eq("id", personaId);
  } else if (phaseName === "principles") {
    const extracted = await extract<string[]>(
      answer,
      '이 텍스트에서 판단 원칙이나 조언을 리스트로 추출해줘. JSON 배열 형태로만 응답해. 예: ["원칙1", "원칙2"]'
    );
    const principles = extracted ?? [answer.trim()];

    const { data: persona } = await sb
      .from("personas")
      .select("principles")
      .eq("id", personaId)
      .single();
    const existing = persona?.principles ?? [];
    await sb
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

    const { data: persona } = await sb
      .from("personas")
      .select("decision_scenarios")
      .eq("id", personaId)
      .single();
    const existing = persona?.decision_scenarios ?? [];
    await sb
      .from("personas")
      .update({ decision_scenarios: [...existing, scenario] })
      .eq("id", personaId);
  } else if (phaseName === "style") {
    await sb.from("personas").update({ style: answer.trim() }).eq("id", personaId);
  }
}
