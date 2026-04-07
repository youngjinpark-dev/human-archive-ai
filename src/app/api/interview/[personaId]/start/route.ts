import { createClient } from "@/lib/supabase/server";
import { getQuestion } from "@/lib/interview-phases";
import { DEEP_SEED_QUESTIONS } from "@/lib/deep-interview";
import { NextResponse } from "next/server";

// POST /api/interview/[personaId]/start — 인터뷰 세션 시작
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

  const body = await request.json().catch(() => ({}));
  const mode: "classic" | "deep" = body.mode === "classic" ? "classic" : body.mode === "deep" ? "deep" : "classic";

  // 페르소나 소유 확인
  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("id", personaId)
    .eq("user_id", user.id)
    .single();
  if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 기존 미완료 세션 확인
  const { data: existing } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("persona_id", personaId)
    .eq("completed", false)
    .single();

  if (existing) {
    const isDeep = existing.mode === "deep";
    if (isDeep) {
      // deep 모드: 마지막 질문을 answers에서 조회하거나 seed 질문 반환
      const { data: lastAnswer } = await supabase
        .from("interview_answers")
        .select("question")
        .eq("session_id", existing.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const answeredCount = existing.question_index;
      const nextQuestion =
        answeredCount < DEEP_SEED_QUESTIONS.length
          ? DEEP_SEED_QUESTIONS[answeredCount]
          : lastAnswer?.question ?? DEEP_SEED_QUESTIONS[0];

      return NextResponse.json({
        session_id: existing.id,
        mode: "deep",
        phase: answeredCount < DEEP_SEED_QUESTIONS.length ? "seed" : "deep_dive",
        question: nextQuestion,
        progress: {
          answered: answeredCount,
          estimated_remaining: Math.max(0, 15 - answeredCount),
          saturation: Number(existing.saturation_score ?? 0),
        },
        completed: false,
      });
    }

    // classic 모드
    const question = getQuestion(existing.phase_index, existing.question_index);
    return NextResponse.json({
      session_id: existing.id,
      mode: "classic",
      question,
      phase_index: existing.phase_index,
      question_index: existing.question_index,
      completed: existing.completed,
    });
  }

  // 새 세션 생성
  if (mode === "deep") {
    const { data: session, error } = await supabase
      .from("interview_sessions")
      .insert({ persona_id: personaId, mode: "deep", total_questions: 0 })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

  // classic 모드
  const { data: session, error } = await supabase
    .from("interview_sessions")
    .insert({ persona_id: personaId, mode: "classic" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const question = getQuestion(0, 0);
  return NextResponse.json({
    session_id: session.id,
    mode: "classic",
    question,
    phase_index: 0,
    question_index: 0,
    completed: false,
  });
}
