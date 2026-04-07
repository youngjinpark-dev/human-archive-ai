import { createClient } from "@/lib/supabase/server";
import { streamChat } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { searchChunks, formatContext } from "@/lib/retriever";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// POST /api/personas/[id]/chat — 스트리밍 채팅 (thinking/text 분리)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { message, session_id } = body;

  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // 페르소나 조회
  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 채팅 세션 관리
  let chatSessionId = session_id;
  if (!chatSessionId) {
    const { data: newSession } = await supabase
      .from("chat_sessions")
      .insert({ persona_id: id, user_id: user.id })
      .select()
      .single();
    chatSessionId = newSession?.id;
  }

  // 사용자 메시지 저장
  await supabase.from("chat_messages").insert({
    session_id: chatSessionId,
    role: "user",
    content: message,
  });

  // RAG: 관련 컨텍스트 검색
  const results = await searchChunks(id, message, 5);
  const context = formatContext(results);

  // 시스템 프롬프트 생성
  const systemPrompt = buildSystemPrompt(persona as Persona, context);

  // 최근 대화 히스토리 조회 (최근 10개)
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", chatSessionId)
    .order("created_at", { ascending: true })
    .limit(10);

  const messages = (history ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 스트리밍 응답
  let fullResponse = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        let truncated = false;

        for await (const chunk of streamChat(systemPrompt, messages, {
          maxTokens: 4096,
        })) {
          if (chunk.truncated) {
            truncated = true;
            continue;
          }
          if (chunk.text) {
            fullResponse += chunk.text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", text: chunk.text, session_id: chatSessionId })}\n\n`
              )
            );
          }
        }

        // 어시스턴트 메시지 저장
        await supabase.from("chat_messages").insert({
          session_id: chatSessionId,
          role: "assistant",
          content: fullResponse,
        });

        // 잘림 여부 전달
        if (truncated) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "truncated", session_id: chatSessionId })}\n\n`
            )
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Stream error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", text: msg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
