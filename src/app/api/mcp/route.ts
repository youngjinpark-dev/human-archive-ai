/**
 * Streamable HTTP MCP Server endpoint
 *
 * Claude Code에서 다음으로 연결:
 *   claude mcp add human-archive-ai --transport http https://human-archive-ai.vercel.app/api/mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { chat } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { searchChunks, formatContext } from "@/lib/retriever";
import { loadFramework } from "@/lib/framework-loader";
import { embedText } from "@/lib/embedding";
import type { Persona } from "@/types";

export const maxDuration = 120;

// ============================================================
// Helper: API 키 검증
// ============================================================
async function validateApiKey(apiKey: string) {
  const supabase = createServiceClient();
  const keyHash = hashApiKey(apiKey);
  const { data } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("active", true)
    .single();
  return data;
}

// ============================================================
// MCP 서버 생성 + 도구 등록
// ============================================================
function createMcpServer(apiKey: string) {
  const server = new McpServer({
    name: "human-archive-ai",
    version: "2.0.0",
  });

  const supabase = createServiceClient();

  // ---- chat ----
  server.tool(
    "chat",
    "전문가 AI 페르소나와 대화합니다.",
    {
      persona_id: z.string().describe("페르소나 ID"),
      message: z.string().describe("페르소나에게 보낼 메시지"),
    },
    async ({ persona_id, message }) => {
      const keyRecord = await validateApiKey(apiKey);
      if (!keyRecord) return { content: [{ type: "text" as const, text: "오류: Invalid API key" }] };

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://human-archive-ai.vercel.app" : "http://localhost:3000"}/api/external/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ persona_id, message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { content: [{ type: "text" as const, text: `오류: ${err.error || res.statusText}` }] };
      }
      const data = await res.json();
      return { content: [{ type: "text" as const, text: data.response }] };
    }
  );

  // ---- persona_list ----
  server.tool("persona_list", "페르소나 목록을 조회합니다.", {}, async () => {
    const keyRecord = await validateApiKey(apiKey);
    if (!keyRecord) return { content: [{ type: "text" as const, text: "오류: Invalid API key" }] };

    const { data: personas } = await supabase
      .from("personas")
      .select("id, name, domain, description")
      .eq("user_id", keyRecord.user_id)
      .order("created_at", { ascending: false });

    if (!personas || personas.length === 0) {
      return { content: [{ type: "text" as const, text: "사용 가능한 페르소나가 없습니다.\npersona_create 도구로 생성하세요." }] };
    }
    const list = personas.map((p) => `- ${p.name} (${p.id})${p.description ? `\n  ${p.description}` : ""}`).join("\n");
    return { content: [{ type: "text" as const, text: `페르소나 목록:\n\n${list}` }] };
  });

  // ---- persona_create ----
  server.tool(
    "persona_create",
    "새 전문가 페르소나를 생성합니다.",
    {
      name: z.string().describe("페르소나 이름"),
      domain: z.string().optional().describe("전문 분야"),
      description: z.string().optional().describe("페르소나 설명"),
      style: z.string().optional().describe("대화 스타일"),
    },
    async ({ name, domain, description, style }) => {
      const keyRecord = await validateApiKey(apiKey);
      if (!keyRecord) return { content: [{ type: "text" as const, text: "오류: Invalid API key" }] };

      const { data: persona, error } = await supabase
        .from("personas")
        .insert({ user_id: keyRecord.user_id, name, domain: domain ?? null, description: description ?? null, style: style ?? null })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `오류: ${error.message}` }] };

      // judgment_frameworks 자동 생성
      await supabase.from("judgment_frameworks").insert({ persona_id: persona.id, status: "building" });

      return { content: [{ type: "text" as const, text: `페르소나 생성 완료!\n이름: ${persona.name}\nID: ${persona.id}\n\nchat 도구로 대화하거나, interview(mode='deep')로 판단 프레임워크를 구축하세요.` }] };
    }
  );

  // ---- get_framework ----
  server.tool(
    "get_framework",
    "전문가의 판단 프레임워크를 조회합니다.",
    { persona_id: z.string().describe("페르소나 ID") },
    async ({ persona_id }) => {
      const frameworkData = await loadFramework(persona_id);
      if (!frameworkData) return { content: [{ type: "text" as const, text: "프레임워크가 없습니다. interview(mode='deep')로 구축하세요." }] };

      const axesText = frameworkData.axes.map((a) =>
        `- **${a.name}** (중요도: ${a.weight}): ${a.description ?? ""}`
      ).join("\n");
      const patternsText = frameworkData.patterns.map((p) =>
        `- IF ${p.condition} → THEN ${p.action}${p.reasoning ? ` (${p.reasoning})` : ""}`
      ).join("\n");

      return { content: [{ type: "text" as const, text: [
        frameworkData.framework.philosophy ? `판단 철학: ${frameworkData.framework.philosophy}` : "",
        axesText ? `판단 축:\n${axesText}` : "",
        patternsText ? `핵심 패턴:\n${patternsText}` : "",
      ].filter(Boolean).join("\n") }] };
    }
  );

  // ---- consult_judgment ----
  server.tool(
    "consult_judgment",
    "전문가의 판단 프레임워크 기반 상황 자문을 받습니다.",
    {
      persona_id: z.string().describe("페르소나 ID"),
      situation: z.string().describe("판단이 필요한 상황"),
    },
    async ({ persona_id, situation }) => {
      // API를 통해 호출 (LLM 호출이 무거우므로)
      const res = await fetch("https://human-archive-ai.vercel.app/api/external/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ persona_id, situation }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { content: [{ type: "text" as const, text: `오류: ${err.error || res.statusText}` }] };
      }

      const data = await res.json();
      const axesInfo = data.applicable_axes?.map((a: { name: string; weight: number }) => `  - ${a.name} (${a.weight})`).join("\n") ?? "";
      const patternsInfo = data.relevant_patterns?.map((p: { condition: string; action: string }) => `  - IF ${p.condition} → THEN ${p.action}`).join("\n") ?? "";

      return { content: [{ type: "text" as const, text: [
        `판단: ${data.judgment}`, "", `근거: ${data.reasoning}`,
        axesInfo ? `\n적용된 판단 축:\n${axesInfo}` : "",
        patternsInfo ? `\n매칭된 패턴:\n${patternsInfo}` : "",
        data.confidence ? `\n신뢰도: ${data.confidence}` : "",
        data.caveats?.length ? `\n주의사항:\n${data.caveats.map((c: string) => `  - ${c}`).join("\n")}` : "",
      ].filter(Boolean).join("\n") }] };
    }
  );

  // ---- find_similar_story ----
  server.tool(
    "find_similar_story",
    "전문가의 유사 경험 스토리를 검색합니다.",
    {
      persona_id: z.string().describe("페르소나 ID"),
      query: z.string().describe("검색할 상황이나 키워드"),
    },
    async ({ persona_id, query }) => {
      const res = await fetch("https://human-archive-ai.vercel.app/api/external/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ persona_id, query }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { content: [{ type: "text" as const, text: `오류: ${err.error || res.statusText}` }] };
      }

      const data = await res.json();
      if (!data.stories?.length) {
        return { content: [{ type: "text" as const, text: "관련 경험 스토리를 찾을 수 없습니다." }] };
      }

      const list = data.stories.map((s: { title: string; summary: string; context: string; decision: string; outcome?: string; lesson?: string; relevance?: number }) =>
        [
          `### ${s.title}${s.relevance ? ` (관련도: ${Math.round(s.relevance * 100)}%)` : ""}`,
          s.summary,
          `상황: ${s.context}`,
          `판단: ${s.decision}`,
          s.outcome ? `결과: ${s.outcome}` : "",
          s.lesson ? `교훈: ${s.lesson}` : "",
        ].filter(Boolean).join("\n")
      ).join("\n\n");

      return { content: [{ type: "text" as const, text: `관련 경험 스토리 (${data.stories.length}건):\n\n${list}` }] };
    }
  );

  // ---- compare_approaches ----
  server.tool(
    "compare_approaches",
    "여러 접근법을 전문가 관점으로 비교합니다.",
    {
      persona_id: z.string().describe("페르소나 ID"),
      approaches: z.array(z.string()).min(2).max(5).describe("비교할 접근법 (2~5개)"),
      context: z.string().optional().describe("상황 설명"),
    },
    async ({ persona_id, approaches, context }) => {
      const res = await fetch("https://human-archive-ai.vercel.app/api/external/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ persona_id, approaches, context }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { content: [{ type: "text" as const, text: `오류: ${err.error || res.statusText}` }] };
      }

      const data = await res.json();
      return { content: [{ type: "text" as const, text: `추천: **${data.recommended}**\n\n근거: ${data.reasoning}` }] };
    }
  );

  // ---- interview, upload_audio, store_search, store_preview, my_purchased_personas ----
  // 이 도구들은 기존 external API를 proxy 호출
  const API_URL = "https://human-archive-ai.vercel.app";

  server.tool(
    "interview",
    "페르소나에게 인터뷰를 진행합니다. mode='deep'이면 심층 인터뷰, 'classic'이면 기존 9질문.",
    {
      persona_id: z.string(),
      action: z.enum(["start", "answer"]),
      mode: z.enum(["deep", "classic"]).optional(),
      session_id: z.string().optional(),
      answer: z.string().optional(),
    },
    async ({ persona_id, action, mode, session_id, answer }) => {
      const res = await fetch(`${API_URL}/api/external/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ persona_id, action, mode, session_id, answer }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { content: [{ type: "text" as const, text: `오류: ${err.error || res.statusText}` }] };
      }
      const data = await res.json();

      if (action === "start") {
        return { content: [{ type: "text" as const, text: `인터뷰 시작 (모드: ${data.mode ?? "classic"})\n세션 ID: ${data.session_id}\n\n질문: ${data.question}` }] };
      }
      if (data.completed || data.status === "completed") {
        return { content: [{ type: "text" as const, text: "인터뷰 완료! chat 도구로 대화하세요." }] };
      }
      if (data.status === "confirming") {
        return { content: [{ type: "text" as const, text: `프레임워크 추출 완료!\n축: ${data.framework_summary?.axes?.length ?? 0}개\n패턴: ${data.framework_summary?.patterns?.length ?? 0}개\n스토리: ${data.framework_summary?.stories?.length ?? 0}개` }] };
      }
      return { content: [{ type: "text" as const, text: `다음 질문: ${data.next_question ?? data.question}\n\n진행: ${data.progress?.answered ?? "?"}개 답변` }] };
    }
  );

  server.tool("store_search", "스토어에서 전문가 페르소나를 검색합니다.", {
    query: z.string().optional(),
    category: z.string().optional(),
  }, async ({ query, category }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    const res = await fetch(`${API_URL}/api/external/store?${params}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return { content: [{ type: "text" as const, text: "검색 오류" }] };
    const data = await res.json();
    if (!data.listings?.length) return { content: [{ type: "text" as const, text: "검색 결과 없음" }] };
    const list = data.listings.map((l: { title: string; persona_name: string; category: string; is_free: boolean; price_krw: number; id: string; description?: string }) =>
      `- **${l.title}** (${l.persona_name})\n  ${l.category} | ${l.is_free ? "무료" : `${l.price_krw?.toLocaleString()}원`}\n  ID: ${l.id}`
    ).join("\n\n");
    return { content: [{ type: "text" as const, text: `검색 결과 (${data.listings.length}건):\n\n${list}` }] };
  });

  server.tool("store_preview", "스토어 페르소나를 시식합니다. 2회 무료.", {
    listing_id: z.string(),
    message: z.string(),
  }, async ({ listing_id, message }) => {
    const res = await fetch(`${API_URL}/api/external/store/${listing_id}/trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ message }),
    });
    if (res.status === 429) {
      return { content: [{ type: "text" as const, text: "체험 횟수를 모두 사용했습니다. 구매 후 무제한 대화 가능합니다." }] };
    }
    if (!res.ok) return { content: [{ type: "text" as const, text: "시식 오류" }] };
    const data = await res.json();
    return { content: [{ type: "text" as const, text: `${data.response}\n\n---\n남은 체험: ${data.messages_remaining}회` }] };
  });

  server.tool("my_purchased_personas", "구매한 페르소나 목록을 조회합니다.", {}, async () => {
    const res = await fetch(`${API_URL}/api/external/purchases`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return { content: [{ type: "text" as const, text: "조회 오류" }] };
    const data = await res.json();
    if (!data.purchases?.length) return { content: [{ type: "text" as const, text: "구매한 페르소나가 없습니다." }] };
    const list = data.purchases.map((p: { persona: { name: string; domain?: string }; persona_id: string; created_at: string }) =>
      `- **${p.persona.name}** (${p.persona_id})${p.persona.domain ? `\n  분야: ${p.persona.domain}` : ""}`
    ).join("\n\n");
    return { content: [{ type: "text" as const, text: `구매 목록 (${data.purchases.length}건):\n\n${list}` }] };
  });

  server.tool("upload_audio", "음성 파일을 업로드하여 지식을 아카이빙합니다.", {
    persona_id: z.string(),
    file_path: z.string().describe("음성 파일 로컬 경로"),
  }, async () => {
    return { content: [{ type: "text" as const, text: "Streamable HTTP 모드에서는 로컬 파일 접근이 불가합니다.\n웹 대시보드에서 업로드하거나, stdio 모드의 MCP를 사용하세요." }] };
  });

  return server;
}

// ============================================================
// 세션 관리 (인메모리 — Vercel Fluid Compute에서 재사용됨)
// ============================================================
const sessions = new Map<string, { transport: WebStandardStreamableHTTPServerTransport; server: McpServer }>();

// ============================================================
// POST /api/mcp — JSON-RPC 메시지 수신
// ============================================================
export async function POST(request: Request) {
  // API 키를 Authorization 헤더 또는 쿼리에서 추출
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.replace("Bearer ", "") ??
    new URL(request.url).searchParams.get("api_key") ?? "";

  const sessionId = request.headers.get("mcp-session-id");

  // 기존 세션이 있으면 재사용
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    return transport.handleRequest(request);
  }

  // 새 세션 생성
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (newSessionId) => {
      sessions.set(newSessionId, { transport, server });
      // 5분 후 세션 정리
      setTimeout(() => sessions.delete(newSessionId), 5 * 60 * 1000);
    },
  });

  const server = createMcpServer(apiKey);
  await server.connect(transport);

  return transport.handleRequest(request);
}

// ============================================================
// GET /api/mcp — SSE 스트림 연결
// ============================================================
export async function GET(request: Request) {
  const sessionId = request.headers.get("mcp-session-id");

  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    return transport.handleRequest(request);
  }

  return new Response("Session not found. Send POST first.", { status: 400 });
}

// ============================================================
// DELETE /api/mcp — 세션 종료
// ============================================================
export async function DELETE(request: Request) {
  const sessionId = request.headers.get("mcp-session-id");

  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    const response = await transport.handleRequest(request);
    sessions.delete(sessionId);
    return response;
  }

  return new Response("Session not found", { status: 404 });
}
