import { createClient } from "@/lib/supabase/server";
import { getQuestion } from "@/lib/interview-phases";
import { NextResponse } from "next/server";

// POST /api/interview/[personaId]/start — 인터뷰 세션 시작
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const question = getQuestion(existing.phase_index, existing.question_index);
    return NextResponse.json({
      session_id: existing.id,
      question,
      phase_index: existing.phase_index,
      question_index: existing.question_index,
      completed: existing.completed,
    });
  }

  // 새 세션 생성
  const { data: session, error } = await supabase
    .from("interview_sessions")
    .insert({ persona_id: personaId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const question = getQuestion(0, 0);
  return NextResponse.json({
    session_id: session.id,
    question,
    phase_index: 0,
    question_index: 0,
    completed: false,
  });
}
