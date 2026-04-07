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
      const errorMsg = err.error || res.statusText;

      if (res.status === 404) {
        return {
          content: [
            {
              type: "text",
              text: [
                `오류: ${errorMsg}`,
                "",
                "페르소나를 찾을 수 없습니다. persona_list로 사용 가능한 페르소나를 확인하세요.",
                "페르소나가 없다면 persona_create 도구로 생성하거나,",
                "interview(인터뷰)나 upload_audio(음성 업로드)로 전문가 지식을 아카이빙할 수 있습니다.",
              ].join("\n"),
            },
          ],
        };
      }

      return {
        content: [
          { type: "text", text: `오류: ${errorMsg}` },
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
          {
            type: "text",
            text: [
              "사용 가능한 페르소나가 없습니다.",
              "",
              "페르소나를 먼저 생성해야 대화할 수 있습니다.",
              "",
              "방법 1: persona_create 도구로 직접 생성 (이름, 전문분야, 설명 입력)",
              "방법 2: 웹 대시보드에서 생성 → " + `${API_URL}/personas/new`,
              "",
              "페르소나 생성 후 아래 도구로 전문가의 지식을 아카이빙할 수 있습니다:",
              "  - interview: 9개 질문으로 전문가의 판단 체계를 구조화",
              "  - upload_audio: 음성 파일 업로드로 지식 임베딩",
              "",
              "생성 후 다시 persona_list를 호출하면 목록에 표시됩니다.",
            ].join("\n"),
          },
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
// Tool: 페르소나 생성
// ============================================================
server.tool(
  "persona_create",
  "새 전문가 페르소나를 생성합니다. 생성 후 interview로 인터뷰하거나 upload_audio로 음성 파일을 업로드하여 전문가의 지식을 아카이빙할 수 있습니다.",
  {
    name: z.string().describe("페르소나 이름 (예: 김철수)"),
    domain: z
      .string()
      .optional()
      .describe("전문 분야 (예: 백엔드 개발, AI 활용)"),
    description: z
      .string()
      .optional()
      .describe("페르소나 설명 (예: 7년 경력의 Spring Boot 개발자)"),
    style: z
      .string()
      .optional()
      .describe("대화 스타일 (예: 친근하고 비유를 많이 사용)"),
  },
  async ({ name, domain, description, style }) => {
    const res = await fetch(`${API_URL}/api/external/personas/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ name, domain, description, style }),
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
    const p = data.persona;
    return {
      content: [
        {
          type: "text",
          text: [
            `페르소나가 생성되었습니다!`,
            "",
            `이름: ${p.name}`,
            `ID: ${p.id}`,
            p.domain ? `분야: ${p.domain}` : "",
            p.description ? `설명: ${p.description}` : "",
            "",
            "다음 단계로 전문가의 지식을 아카이빙하세요:",
            `  1. interview 도구: 9개 질문으로 판단 체계를 구조화`,
            `  2. upload_audio 도구: 음성 파일로 지식 임베딩`,
            "",
            `chat 도구에 persona_id: "${p.id}" 를 전달하면 대화할 수 있습니다.`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  }
);

// ============================================================
// Tool: 인터뷰 (질의응답으로 페르소나 구축)
// ============================================================
server.tool(
  "interview",
  "페르소나에게 인터뷰를 진행합니다. 9개의 구조화된 질문(전문분야, 판단원칙, 의사결정 시나리오, 대화스타일)을 통해 전문가의 판단 체계를 아카이빙합니다. 처음 호출 시 action='start'로 시작하고, 이후 사용자의 답변을 action='answer'로 전달합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    action: z
      .enum(["start", "answer"])
      .describe("'start': 인터뷰 시작/재개, 'answer': 답변 제출"),
    session_id: z
      .string()
      .optional()
      .describe("인터뷰 세션 ID (answer 시 필수, start 응답에서 받은 값)"),
    answer: z
      .string()
      .optional()
      .describe("사용자의 답변 (answer 시 필수)"),
  },
  async ({ persona_id, action, session_id, answer }) => {
    const res = await fetch(`${API_URL}/api/external/interview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ persona_id, action, session_id, answer }),
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

    if (action === "start") {
      return {
        content: [
          {
            type: "text",
            text: [
              "인터뷰를 시작합니다.",
              "",
              `세션 ID: ${data.session_id}`,
              `단계: ${data.phase}`,
              "",
              `질문: ${data.question}`,
              "",
              "사용자의 답변을 받아 interview 도구에 action='answer', session_id, answer를 전달하세요.",
            ].join("\n"),
          },
        ],
      };
    }

    // answer 결과
    if (data.completed) {
      return {
        content: [
          {
            type: "text",
            text: [
              "인터뷰가 완료되었습니다!",
              "",
              "전문가의 판단 체계가 페르소나에 반영되었습니다.",
              "이제 chat 도구로 이 페르소나와 대화할 수 있습니다.",
              "",
              "추가로 upload_audio 도구로 음성 파일을 업로드하면",
              "더 풍부한 지식을 아카이빙할 수 있습니다.",
            ].join("\n"),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: [
            `단계: ${data.phase}`,
            "",
            `다음 질문: ${data.next_question}`,
            "",
            "사용자의 답변을 받아 다시 interview 도구에 전달하세요.",
          ].join("\n"),
        },
      ],
    };
  }
);

// ============================================================
// Tool: 음성 파일 업로드
// ============================================================
server.tool(
  "upload_audio",
  "음성 파일을 업로드하여 페르소나의 지식을 아카이빙합니다. 음성은 자동으로 텍스트로 변환(STT)되고, 임베딩되어 RAG 검색에 활용됩니다. 지원 형식: mp3, wav, m4a, ogg, webm 등.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    file_path: z
      .string()
      .describe("업로드할 음성 파일의 로컬 절대 경로"),
  },
  async ({ persona_id, file_path }) => {
    // 로컬 파일 읽기
    const fs = await import("fs");
    const path = await import("path");

    if (!fs.existsSync(file_path)) {
      return {
        content: [
          {
            type: "text",
            text: `오류: 파일을 찾을 수 없습니다 → ${file_path}`,
          },
        ],
      };
    }

    const fileName = path.basename(file_path);
    const fileBuffer = fs.readFileSync(file_path);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("persona_id", persona_id);

    const res = await fetch(`${API_URL}/api/external/upload`, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
      },
      body: formData,
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
      content: [
        {
          type: "text",
          text: [
            "음성 파일 업로드 및 처리가 완료되었습니다!",
            "",
            `파일: ${fileName}`,
            `트랜스크립트 길이: ${data.transcript_length}자`,
            `생성된 청크: ${data.chunks_count}개`,
            "",
            "음성 내용이 페르소나의 지식으로 임베딩되었습니다.",
            "이제 chat 도구로 이 지식을 기반으로 대화할 수 있습니다.",
          ].join("\n"),
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
