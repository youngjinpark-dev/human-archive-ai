import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/interview/[personaId]/confirm — 프레임워크 확인/수정
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
  const { session_id, confirmed, edits } = body;

  if (!session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  // 세션 조회
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", session_id)
    .eq("persona_id", personaId)
    .single();

  if (!session || session.mode !== "deep") {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // 프레임워크 조회
  const { data: framework } = await serviceClient
    .from("judgment_frameworks")
    .select("*")
    .eq("persona_id", personaId)
    .single();

  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  // 수정 사항 적용
  if (edits) {
    if (edits.axes && Array.isArray(edits.axes)) {
      for (const axisEdit of edits.axes) {
        if (axisEdit.id) {
          const updates: Record<string, unknown> = {};
          if (axisEdit.weight !== undefined) updates.weight = axisEdit.weight;
          if (axisEdit.description !== undefined) updates.description = axisEdit.description;
          if (Object.keys(updates).length > 0) {
            await serviceClient
              .from("judgment_axes")
              .update(updates)
              .eq("id", axisEdit.id)
              .eq("framework_id", framework.id);
          }
        }
      }
    }

    if (edits.patterns && Array.isArray(edits.patterns)) {
      for (const patternEdit of edits.patterns) {
        if (patternEdit.id) {
          const updates: Record<string, unknown> = {};
          if (patternEdit.action !== undefined) updates.action = patternEdit.action;
          if (patternEdit.reasoning !== undefined) updates.reasoning = patternEdit.reasoning;
          if (Object.keys(updates).length > 0) {
            await serviceClient
              .from("if_then_patterns")
              .update(updates)
              .eq("id", patternEdit.id)
              .eq("framework_id", framework.id);
          }
        }
      }
    }

    if (edits.remove_axes && Array.isArray(edits.remove_axes)) {
      for (const axisId of edits.remove_axes) {
        await serviceClient
          .from("judgment_axes")
          .delete()
          .eq("id", axisId)
          .eq("framework_id", framework.id);
      }
    }

    if (edits.remove_patterns && Array.isArray(edits.remove_patterns)) {
      for (const patternId of edits.remove_patterns) {
        await serviceClient
          .from("if_then_patterns")
          .delete()
          .eq("id", patternId)
          .eq("framework_id", framework.id);
      }
    }

    if (edits.remove_stories && Array.isArray(edits.remove_stories)) {
      for (const storyId of edits.remove_stories) {
        await serviceClient
          .from("experience_stories")
          .delete()
          .eq("id", storyId)
          .eq("framework_id", framework.id);
      }
    }
  }

  if (confirmed) {
    // 프레임워크 상태를 ready로 변경
    await serviceClient
      .from("judgment_frameworks")
      .update({ status: "ready", version: (framework.version ?? 1) + 1 })
      .eq("id", framework.id);

    // 페르소나에 framework_id 연결
    await serviceClient
      .from("personas")
      .update({ framework_id: framework.id })
      .eq("id", personaId);

    // 세션 완료
    await supabase
      .from("interview_sessions")
      .update({ completed: true })
      .eq("id", session_id);

    return NextResponse.json({
      status: "completed",
      framework_id: framework.id,
      framework_status: "ready",
    });
  }

  return NextResponse.json({
    status: "edits_applied",
    framework_id: framework.id,
  });
}
