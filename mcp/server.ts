#!/usr/bin/env npx tsx
/**
 * Human Archive AI — MCP Server
 *
 * 배포된 API를 MCP 프로토콜로 래핑하여
 * Claude Code, Claude Desktop 등에서 페르소나와 대화할 수 있게 합니다.
 *
 * 사용법:
 *   npx tsx mcp/server.ts
 *
 * 환경변수:
 *   HUMAN_ARCHIVE_API_URL  — API 베이스 URL (기본: https://human-archive-ai.vercel.app)
 *   HUMAN_ARCHIVE_API_KEY  — API 키 (ha_...)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL =
  process.env.HUMAN_ARCHIVE_API_URL ||
  "https://human-archive-ai.vercel.app";
const API_KEY = process.env.HUMAN_ARCHIVE_API_KEY || "";

const server = new McpServer({
  name: "human-archive-ai",
  version: "1.0.0",
});

// ============================================================
// Tool: 페르소나와 대화
// ============================================================
server.tool(
  "chat",
  "전문가 AI 페르소나와 대화합니다. 아카이빙된 전문가의 판단 체계를 기반으로 답변합니다.",
  {
    persona_id: z
      .string()
      .describe("페르소나 ID (persona_list로 확인 가능)"),
    message: z.string().describe("페르소나에게 보낼 메시지"),
  },
  async ({ persona_id, message }) => {
    const res = await fetch(`${API_URL}/api/external/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ persona_id, message }),
    });

    if (!res.ok) {
      const err = await res.json();
      return {
        content: [
          { type: "text", text: `오류: ${err.error || res.statusText}` },
        ],
      };
    }

    const data = await res.json();
    return {
      content: [{ type: "text", text: data.response }],
    };
  }
);

// ============================================================
// Tool: 페르소나 목록 조회 (API 키의 허용 범위 내)
// ============================================================
server.tool(
  "persona_list",
  "사용 가능한 전문가 페르소나 목록을 조회합니다.",
  {},
  async () => {
    const res = await fetch(`${API_URL}/api/external/personas`, {
      method: "GET",
      headers: {
        "x-api-key": API_KEY,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      return {
        content: [
          { type: "text", text: `오류: ${err.error || res.statusText}` },
        ],
      };
    }

    const data = await res.json();
    const personas = data.personas;

    if (!personas || personas.length === 0) {
      return {
        content: [
          { type: "text", text: "사용 가능한 페르소나가 없습니다." },
        ],
      };
    }

    const list = personas
      .map(
        (p: { id: string; name: string; domain?: string; description?: string }) =>
          `- ${p.name} (${p.id})${p.description ? `\n  ${p.description}` : ""}`
      )
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `사용 가능한 페르소나 목록:\n\n${list}`,
        },
      ],
    };
  }
);

// ============================================================
// 서버 시작
// ============================================================
async function main() {
  if (!API_KEY) {
    console.error(
      "HUMAN_ARCHIVE_API_KEY 환경변수를 설정해주세요. (ha_... 형식)"
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
