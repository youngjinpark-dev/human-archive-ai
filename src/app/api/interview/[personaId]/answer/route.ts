import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extract } from "@/lib/llm";
import { embedText } from "@/lib/embedding";
import {
  INTERVIEW_PHASES,
  getQuestion,
  getNextPosition,
} from "@/lib/interview-phases";
import {
  DEEP_SEED_QUESTIONS,
  MAX_DEEP_QUESTIONS,
  generateNextQuestion,
  extractFromAnswer,
  calculateSaturation,
  determinePhase,
} from "@/lib/deep-interview";
import type { DecisionScenario, ExtractionResult } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 120;

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

  // deep 모드 분기
  if (session.mode === "deep") {
    try {
      return await handleDeepAnswer(supabase, personaId, session, answer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Deep interview error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // === classic 모드 (기존 로직 유지) ===
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
async function handleDeepAnswer(
  supabase: any,
  personaId: string,
  session: any,
  answer: string
) {
  const serviceClient = createServiceClient();
  const answeredCount = (session.total_questions ?? session.question_index ?? 0);
  const sessionId = session.id;

  // 현재 질문 결정
  const currentQuestion =
    answeredCount < DEEP_SEED_QUESTIONS.length
      ? DEEP_SEED_QUESTIONS[answeredCount]
      : "(동적 생성 질문)";

  // 프레임워크 조회/생성
  let { data: framework } = await serviceClient
    .from("judgment_frameworks")
    .select("*")
    .eq("persona_id", personaId)
    .single();

  if (!framework) {
    const { data: newFw } = await serviceClient
      .from("judgment_frameworks")
      .insert({ persona_id: personaId, status: "building" })
      .select()
      .single();
    framework = newFw;
  }

  if (!framework) {
    return NextResponse.json({ error: "Framework creation failed" }, { status: 500 });
  }

  const newAnsweredCount = answeredCount + 1;

  // Phase 1: 답변 저장 (즉시)
  const phase = determinePhase(answeredCount, Number(session.saturation_score ?? 0));
  await supabase.from("interview_answers").insert({
    session_id: sessionId,
    phase,
    question: currentQuestion,
    answer,
    question_intent: phase === "seed" ? "explore_why" : null,
    extracted_axes: "[]",
    extracted_patterns: "[]",
    extracted_stories: "[]",
  });

  // 세션 카운터 업데이트
  await supabase
    .from("interview_sessions")
    .update({
      question_index: newAnsweredCount,
      total_questions: newAnsweredCount,
    })
    .eq("id", sessionId);

  // Phase 2: 다음 질문 결정 (seed이면 고정 질문으로 즉시 응답)
  if (newAnsweredCount < DEEP_SEED_QUESTIONS.length) {
    // seed 단계: LLM 없이 즉시 응답
    // 백그라운드 추출 fire-and-forget
    runBackgroundExtraction(serviceClient, supabase, framework.id, sessionId, currentQuestion, answer, newAnsweredCount).catch(() => {});

    return NextResponse.json({
      status: "in_progress",
      phase: "seed",
      next_question: DEEP_SEED_QUESTIONS[newAnsweredCount],
      question_intent: "explore_why",
      progress: {
        answered: newAnsweredCount,
        estimated_remaining: Math.max(0, 15 - newAnsweredCount),
        saturation: 0,
      },
    });
  }

  // deep_dive 단계: 추출 + 다음 질문 생성 필요 (LLM 호출)
  // 추출
  const { data: existingAxes } = await serviceClient
    .from("judgment_axes")
    .select("*")
    .eq("framework_id", framework.id);
  const axesNames = (existingAxes ?? []).map((a: { name: string }) => a.name);

  let extraction: ExtractionResult = { newAxes: [], reinforcedAxes: [], newPatterns: [], newStories: [] };
  try {
    extraction = await extractFromAnswer(currentQuestion, answer, axesNames);
    await saveExtraction(serviceClient, framework.id, extraction, sessionId);

    // 답변의 추출 결과 업데이트
    const { data: lastAnswer } = await supabase
      .from("interview_answers")
      .select("id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (lastAnswer) {
      await supabase.from("interview_answers").update({
        extracted_axes: JSON.stringify(extraction.newAxes),
        extracted_patterns: JSON.stringify(extraction.newPatterns),
        extracted_stories: JSON.stringify(extraction.newStories),
      }).eq("id", lastAnswer.id);
    }
  } catch {
    // 추출 실패해도 인터뷰는 계속
  }

  // 포화도 계산
  const { data: recentAnswers } = await supabase
    .from("interview_answers")
    .select("extracted_axes, extracted_patterns, extracted_stories")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentExtractions: ExtractionResult[] = (recentAnswers ?? []).map(
    (a: { extracted_axes: unknown; extracted_patterns: unknown; extracted_stories: unknown }) => ({
      newAxes: Array.isArray(a.extracted_axes) ? a.extracted_axes : [],
      reinforcedAxes: [],
      newPatterns: Array.isArray(a.extracted_patterns) ? a.extracted_patterns : [],
      newStories: Array.isArray(a.extracted_stories) ? a.extracted_stories : [],
    })
  );
  const saturation = calculateSaturation(recentExtractions, 3, newAnsweredCount);

  await supabase
    .from("interview_sessions")
    .update({ saturation_score: saturation })
    .eq("id", sessionId);

  // 종료 조건 확인
  const newPhase = determinePhase(newAnsweredCount, saturation);

  if (newPhase === "confirmation" || newAnsweredCount >= MAX_DEEP_QUESTIONS) {
    const { data: allAxes } = await serviceClient
      .from("judgment_axes").select("*").eq("framework_id", framework.id);
    const { data: allPatterns } = await serviceClient
      .from("if_then_patterns").select("*").eq("framework_id", framework.id);
    const { data: allStories } = await serviceClient
      .from("experience_stories")
      .select("id, title, summary, context, decision, outcome, lesson")
      .eq("framework_id", framework.id);

    return NextResponse.json({
      status: "confirming",
      framework_summary: {
        axes: allAxes ?? [],
        patterns: allPatterns ?? [],
        stories: allStories ?? [],
        philosophy: framework.philosophy,
      },
      message: "추출된 판단 프레임워크를 확인해 주세요.",
      progress: { answered: newAnsweredCount, estimated_remaining: 0, saturation },
    });
  }

  // 다음 질문 생성
  let nextQuestion: string;
  let nextIntent: string;

  try {
    const { data: updatedAxes } = await serviceClient
      .from("judgment_axes").select("*").eq("framework_id", framework.id);
    const { data: updatedPatterns } = await serviceClient
      .from("if_then_patterns").select("*").eq("framework_id", framework.id);
    const { data: updatedStories } = await serviceClient
      .from("experience_stories").select("*").eq("framework_id", framework.id);
    const { data: allAnswers } = await supabase
      .from("interview_answers")
      .select("question, answer")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const result = await generateNextQuestion({
      answers: (allAnswers ?? []).map((a: { question: string; answer: string }) => ({
        question: a.question, answer: a.answer,
      })),
      axes: updatedAxes ?? [],
      patterns: updatedPatterns ?? [],
      stories: updatedStories ?? [],
      saturation,
    });
    nextQuestion = result.question;
    nextIntent = result.intent;
  } catch {
    nextQuestion = "이 분야에서 가장 어려웠던 판단 경험은 무엇인가요?";
    nextIntent = "discover_story";
  }

  return NextResponse.json({
    status: "in_progress",
    phase: newPhase,
    next_question: nextQuestion,
    question_intent: nextIntent,
    extracted: {
      axes: extraction.newAxes,
      patterns: extraction.newPatterns,
      stories: extraction.newStories,
    },
    progress: {
      answered: newAnsweredCount,
      estimated_remaining: Math.max(0, 15 - newAnsweredCount),
      saturation,
    },
  });
}

/**
 * 백그라운드 추출 — seed 단계에서 fire-and-forget으로 실행
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runBackgroundExtraction(
  serviceClient: any,
  supabase: any,
  frameworkId: string,
  sessionId: string,
  question: string,
  answer: string,
  answerCount: number
) {
  const { data: existingAxes } = await serviceClient
    .from("judgment_axes")
    .select("name")
    .eq("framework_id", frameworkId);
  const axesNames = (existingAxes ?? []).map((a: { name: string }) => a.name);

  const extraction = await extractFromAnswer(question, answer, axesNames);
  await saveExtraction(serviceClient, frameworkId, extraction, sessionId);

  // 답변 레코드 업데이트
  const { data: lastAnswer } = await supabase
    .from("interview_answers")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastAnswer) {
    await supabase.from("interview_answers").update({
      extracted_axes: JSON.stringify(extraction.newAxes),
      extracted_patterns: JSON.stringify(extraction.newPatterns),
      extracted_stories: JSON.stringify(extraction.newStories),
    }).eq("id", lastAnswer.id);
  }

  // 포화도 재계산
  const { data: recentAnswers } = await supabase
    .from("interview_answers")
    .select("extracted_axes, extracted_patterns, extracted_stories")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentExtractions: ExtractionResult[] = (recentAnswers ?? []).map(
    (a: { extracted_axes: unknown; extracted_patterns: unknown; extracted_stories: unknown }) => ({
      newAxes: Array.isArray(a.extracted_axes) ? a.extracted_axes : [],
      reinforcedAxes: [],
      newPatterns: Array.isArray(a.extracted_patterns) ? a.extracted_patterns : [],
      newStories: Array.isArray(a.extracted_stories) ? a.extracted_stories : [],
    })
  );
  const saturation = calculateSaturation(recentExtractions, 3, answerCount);

  await supabase
    .from("interview_sessions")
    .update({ saturation_score: saturation })
    .eq("id", sessionId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveExtraction(
  serviceClient: any,
  frameworkId: string,
  extraction: ExtractionResult,
  sourceId: string
) {
  // 새 판단 축 저장
  for (const axis of extraction.newAxes) {
    await serviceClient.from("judgment_axes").insert({
      framework_id: frameworkId,
      name: axis.name,
      description: axis.description,
      weight: axis.weight,
      domain: axis.domain,
      evidence_count: 1,
    });
  }

  // 기존 축 보강
  for (const reinforced of extraction.reinforcedAxes) {
    await serviceClient
      .from("judgment_axes")
      .update({
        evidence_count: serviceClient.rpc ? undefined : undefined, // handled below
      })
      .eq("framework_id", frameworkId)
      .eq("name", reinforced.axisName);

    // evidence_count 증가
    const { data: axis } = await serviceClient
      .from("judgment_axes")
      .select("evidence_count")
      .eq("framework_id", frameworkId)
      .eq("name", reinforced.axisName)
      .single();
    if (axis) {
      await serviceClient
        .from("judgment_axes")
        .update({ evidence_count: (axis.evidence_count ?? 0) + 1 })
        .eq("framework_id", frameworkId)
        .eq("name", reinforced.axisName);
    }
  }

  // If-Then 패턴 저장
  for (const pattern of extraction.newPatterns) {
    await serviceClient.from("if_then_patterns").insert({
      framework_id: frameworkId,
      condition: pattern.condition,
      action: pattern.action,
      reasoning: pattern.reasoning,
      confidence: 0.5,
      source_type: "interview",
      source_id: sourceId,
    });
  }

  // 경험 스토리 저장 (임베딩 포함)
  for (const story of extraction.newStories) {
    const embedding = await embedText(
      `${story.title} ${story.summary} ${story.context}`
    );
    await serviceClient.from("experience_stories").insert({
      framework_id: frameworkId,
      title: story.title,
      summary: story.summary,
      context: story.context,
      decision: story.decision,
      outcome: story.outcome,
      lesson: story.lesson,
      embedding: JSON.stringify(embedding),
      source_type: "interview",
      source_id: sourceId,
    });
  }
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
