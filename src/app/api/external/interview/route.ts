import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
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

// POST /api/external/interview — API 키로 인터뷰 진행
// action: "start" | "answer"
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { persona_id, action, session_id, answer, mode: requestedMode } = body;

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
    const mode: "classic" | "deep" =
      requestedMode === "deep" ? "deep" : "classic";

    // 기존 미완료 세션 확인
    const { data: existing } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("persona_id", persona_id)
      .eq("completed", false)
      .single();

    if (existing) {
      if (existing.mode === "deep") {
        const answeredCount = existing.total_questions ?? existing.question_index ?? 0;
        const seedQ =
          answeredCount < DEEP_SEED_QUESTIONS.length
            ? DEEP_SEED_QUESTIONS[answeredCount]
            : null;
        return NextResponse.json({
          session_id: existing.id,
          mode: "deep",
          phase:
            answeredCount < DEEP_SEED_QUESTIONS.length ? "seed" : "deep_dive",
          question:
            seedQ ?? "이 분야에서 가장 어려웠던 판단 경험은 무엇인가요?",
          progress: {
            answered: answeredCount,
            estimated_remaining: Math.max(0, 15 - answeredCount),
            saturation: Number(existing.saturation_score ?? 0),
          },
          completed: false,
        });
      }

      const question = getQuestion(
        existing.phase_index,
        existing.question_index
      );
      return NextResponse.json({
        session_id: existing.id,
        mode: "classic",
        question,
        phase: INTERVIEW_PHASES[existing.phase_index].name,
        phase_index: existing.phase_index,
        question_index: existing.question_index,
        completed: false,
      });
    }

    if (mode === "deep") {
      const { data: session, error } = await supabase
        .from("interview_sessions")
        .insert({ persona_id, mode: "deep", total_questions: 0 })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        session_id: session.id,
        mode: "deep",
        phase: "seed",
        question: DEEP_SEED_QUESTIONS[0],
        question_intent: "explore_why",
        progress: { answered: 0, estimated_remaining: 15 },
        completed: false,
      });
    }

    // classic mode
    const { data: session, error } = await supabase
      .from("interview_sessions")
      .insert({ persona_id, mode: "classic" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const question = getQuestion(0, 0);
    return NextResponse.json({
      session_id: session.id,
      mode: "classic",
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

    // Deep mode
    if (session.mode === "deep") {
      return handleDeepAnswerExternal(supabase, persona_id, session, answer);
    }

    // Classic mode
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
    const nextPos = getNextPosition(
      session.phase_index,
      session.question_index
    );

    if (nextPos) {
      await supabase
        .from("interview_sessions")
        .update({
          phase_index: nextPos.phaseIndex,
          question_index: nextPos.questionIndex,
        })
        .eq("id", session_id);

      const nextQuestion = getQuestion(
        nextPos.phaseIndex,
        nextPos.questionIndex
      );
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
async function handleDeepAnswerExternal(
  supabase: any,
  personaId: string,
  session: any,
  answer: string
) {
  const answeredCount = session.total_questions ?? session.question_index ?? 0;
  const sessionId = session.id;

  const currentQuestion =
    answeredCount < DEEP_SEED_QUESTIONS.length
      ? DEEP_SEED_QUESTIONS[answeredCount]
      : "(동적 생성 질문)";

  // 프레임워크 조회/생성
  let { data: framework } = await supabase
    .from("judgment_frameworks")
    .select("*")
    .eq("persona_id", personaId)
    .single();

  if (!framework) {
    const { data: newFw } = await supabase
      .from("judgment_frameworks")
      .insert({ persona_id: personaId, status: "building" })
      .select()
      .single();
    framework = newFw;
  }

  if (!framework) {
    return NextResponse.json(
      { error: "Framework creation failed" },
      { status: 500 }
    );
  }

  // 기존 axes 이름 조회
  const { data: existingAxes } = await supabase
    .from("judgment_axes")
    .select("name")
    .eq("framework_id", framework.id);
  const axesNames = (existingAxes ?? []).map((a: { name: string }) => a.name);

  // 답변에서 판단 패턴 추출
  const extraction = await extractFromAnswer(currentQuestion, answer, axesNames);

  // 추출 결과 DB 저장
  await saveExtractionExternal(supabase, framework.id, extraction, sessionId);

  // 답변 저장
  const phase = determinePhase(
    answeredCount,
    Number(session.saturation_score ?? 0)
  );
  await supabase.from("interview_answers").insert({
    session_id: sessionId,
    phase,
    question: currentQuestion,
    answer,
    extracted_axes: JSON.stringify(extraction.newAxes),
    extracted_patterns: JSON.stringify(extraction.newPatterns),
    extracted_stories: JSON.stringify(extraction.newStories),
  });

  const newAnsweredCount = answeredCount + 1;

  // 포화도 계산
  const { data: recentAnswers } = await supabase
    .from("interview_answers")
    .select("extracted_axes, extracted_patterns, extracted_stories")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentExtractions: ExtractionResult[] = (recentAnswers ?? []).map(
    (a: {
      extracted_axes: unknown;
      extracted_patterns: unknown;
      extracted_stories: unknown;
    }) => ({
      newAxes: Array.isArray(a.extracted_axes) ? a.extracted_axes : [],
      reinforcedAxes: [],
      newPatterns: Array.isArray(a.extracted_patterns)
        ? a.extracted_patterns
        : [],
      newStories: Array.isArray(a.extracted_stories)
        ? a.extracted_stories
        : [],
    })
  );
  const saturation = calculateSaturation(recentExtractions);

  // 세션 업데이트
  await supabase
    .from("interview_sessions")
    .update({
      question_index: newAnsweredCount,
      total_questions: newAnsweredCount,
      saturation_score: saturation,
    })
    .eq("id", sessionId);

  const newPhase = determinePhase(newAnsweredCount, saturation);

  if (newPhase === "confirmation" || newAnsweredCount >= MAX_DEEP_QUESTIONS) {
    return NextResponse.json({
      status: "confirming",
      message:
        "추출된 판단 프레임워크를 확인해 주세요. 수정할 부분이 있나요?",
      progress: {
        answered: newAnsweredCount,
        estimated_remaining: 0,
        saturation,
      },
      completed: false,
    });
  }

  // 다음 질문 생성
  let nextQuestion: string;
  let nextIntent: string;

  if (newAnsweredCount < DEEP_SEED_QUESTIONS.length) {
    nextQuestion = DEEP_SEED_QUESTIONS[newAnsweredCount];
    nextIntent = "explore_why";
  } else {
    const { data: updatedAxes } = await supabase
      .from("judgment_axes")
      .select("*")
      .eq("framework_id", framework.id);
    const { data: updatedPatterns } = await supabase
      .from("if_then_patterns")
      .select("*")
      .eq("framework_id", framework.id);
    const { data: updatedStories } = await supabase
      .from("experience_stories")
      .select("*")
      .eq("framework_id", framework.id);
    const { data: allAnswers } = await supabase
      .from("interview_answers")
      .select("question, answer")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const result = await generateNextQuestion({
      answers: (allAnswers ?? []).map(
        (a: { question: string; answer: string }) => ({
          question: a.question,
          answer: a.answer,
        })
      ),
      axes: updatedAxes ?? [],
      patterns: updatedPatterns ?? [],
      stories: updatedStories ?? [],
      saturation,
    });
    nextQuestion = result.question;
    nextIntent = result.intent;
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
    completed: false,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveExtractionExternal(
  supabase: any,
  frameworkId: string,
  extraction: ExtractionResult,
  sourceId: string
) {
  for (const axis of extraction.newAxes) {
    await supabase.from("judgment_axes").insert({
      framework_id: frameworkId,
      name: axis.name,
      description: axis.description,
      weight: axis.weight,
      domain: axis.domain,
      evidence_count: 1,
    });
  }

  for (const reinforced of extraction.reinforcedAxes) {
    const { data: axis } = await supabase
      .from("judgment_axes")
      .select("evidence_count")
      .eq("framework_id", frameworkId)
      .eq("name", reinforced.axisName)
      .single();
    if (axis) {
      await supabase
        .from("judgment_axes")
        .update({ evidence_count: (axis.evidence_count ?? 0) + 1 })
        .eq("framework_id", frameworkId)
        .eq("name", reinforced.axisName);
    }
  }

  for (const pattern of extraction.newPatterns) {
    await supabase.from("if_then_patterns").insert({
      framework_id: frameworkId,
      condition: pattern.condition,
      action: pattern.action,
      reasoning: pattern.reasoning,
      confidence: 0.5,
      source_type: "interview",
      source_id: sourceId,
    });
  }

  for (const story of extraction.newStories) {
    const embedding = await embedText(
      `${story.title} ${story.summary} ${story.context}`
    );
    await supabase.from("experience_stories").insert({
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
  if (phaseName === "domain") {
    const { data: persona } = await supabase
      .from("personas")
      .select("domain")
      .eq("id", personaId)
      .single();
    const newDomain = persona?.domain
      ? `${persona.domain} | ${answer.trim()}`
      : answer.trim();
    await supabase
      .from("personas")
      .update({ domain: newDomain })
      .eq("id", personaId);
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
    await supabase
      .from("personas")
      .update({ style: answer.trim() })
      .eq("id", personaId);
  }
}
