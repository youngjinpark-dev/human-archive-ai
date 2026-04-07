import { createClient } from "@/lib/supabase/server";
import { INTERVIEW_PHASES, getTotalQuestions } from "@/lib/interview-phases";
import { NextResponse } from "next/server";

// GET /api/interview/[personaId]/status
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("persona_id", personaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    return NextResponse.json({ started: false });
  }

  const total = getTotalQuestions();
  const answered =
    INTERVIEW_PHASES.slice(0, session.phase_index).reduce(
      (sum: number, p: { questions: string[] }) => sum + p.questions.length,
      0
    ) + session.question_index;

  const currentPhase =
    session.phase_index < INTERVIEW_PHASES.length
      ? INTERVIEW_PHASES[session.phase_index].name
      : "완료";

  return NextResponse.json({
    started: true,
    session_id: session.id,
    current_phase: currentPhase,
    progress: `${answered}/${total}`,
    completed: session.completed,
  });
}
