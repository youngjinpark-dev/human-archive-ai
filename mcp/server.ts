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
  "페르소나에게 인터뷰를 진행합니다. mode='deep'(기본)이면 동적 심층 인터뷰로 판단 프레임워크를 구축하고, mode='classic'이면 기존 9개 고정 질문으로 진행합니다. 처음 호출 시 action='start'로 시작하고, 이후 사용자의 답변을 action='answer'로 전달합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    action: z
      .enum(["start", "answer"])
      .describe("'start': 인터뷰 시작/재개, 'answer': 답변 제출"),
    mode: z
      .enum(["deep", "classic"])
      .optional()
      .describe("인터뷰 모드 (기본: 'deep'). deep=심층 판단 프레임워크 구축, classic=기존 9질문"),
    session_id: z
      .string()
      .optional()
      .describe("인터뷰 세션 ID (answer 시 필수, start 응답에서 받은 값)"),
    answer: z
      .string()
      .optional()
      .describe("사용자의 답변 (answer 시 필수)"),
  },
  async ({ persona_id, action, mode, session_id, answer }) => {
    const res = await fetch(`${API_URL}/api/external/interview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ persona_id, action, mode: mode ?? "deep", session_id, answer }),
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
      const progressInfo = data.progress
        ? `\n진행: ${data.progress.answered ?? 0}/${data.progress.estimated_remaining ? data.progress.answered + data.progress.estimated_remaining : "?"}개`
        : "";
      return {
        content: [
          {
            type: "text",
            text: [
              `인터뷰를 시작합니다. (모드: ${data.mode ?? "classic"})`,
              "",
              `세션 ID: ${data.session_id}`,
              `단계: ${data.phase ?? "시작"}`,
              progressInfo,
              "",
              `질문: ${data.question}`,
              "",
              "사용자의 답변을 받아 interview 도구에 action='answer', session_id, answer를 전달하세요.",
            ].join("\n"),
          },
        ],
      };
    }

    // confirming (deep 모드 확인 단계)
    if (data.status === "confirming") {
      return {
        content: [
          {
            type: "text",
            text: [
              "판단 프레임워크 추출이 완료되었습니다!",
              "",
              data.message ?? "추출된 프레임워크를 확인해 주세요.",
              "",
              data.progress ? `답변 수: ${data.progress.answered}개, 포화도: ${data.progress.saturation}` : "",
              "",
              "확인이 완료되면 confirm API를 호출하거나, 사용자에게 확인을 요청하세요.",
            ].filter(Boolean).join("\n"),
          },
        ],
      };
    }

    // answer 결과 - completed
    if (data.completed || data.status === "completed") {
      return {
        content: [
          {
            type: "text",
            text: [
              "인터뷰가 완료되었습니다!",
              "",
              "전문가의 판단 체계가 페르소나에 반영되었습니다.",
              "이제 chat 도구로 이 페르소나와 대화할 수 있습니다.",
              data.framework_id ? `\n프레임워크 ID: ${data.framework_id}` : "",
              "",
              "추가로 upload_audio 도구로 음성 파일을 업로드하면",
              "더 풍부한 지식을 아카이빙할 수 있습니다.",
              "",
              "consult_judgment 도구로 구조화된 판단 자문도 받을 수 있습니다.",
            ].filter(Boolean).join("\n"),
          },
        ],
      };
    }

    // in_progress
    const extractedInfo = data.extracted
      ? `\n추출됨: 축 ${data.extracted.axes?.length ?? 0}개, 패턴 ${data.extracted.patterns?.length ?? 0}개, 스토리 ${data.extracted.stories?.length ?? 0}개`
      : "";
    const progressInfo2 = data.progress
      ? `\n진행: ${data.progress.answered}개 답변, 포화도: ${data.progress.saturation ?? 0}`
      : "";

    return {
      content: [
        {
          type: "text",
          text: [
            `단계: ${data.phase ?? data.status}`,
            extractedInfo,
            progressInfo2,
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
// Tool: 스토어 검색
// ============================================================
server.tool(
  "store_search",
  "스토어에서 전문가 페르소나를 검색합니다.",
  {
    query: z.string().optional().describe("검색어 (이름, 설명 등)"),
    category: z.string().optional().describe("카테고리 필터"),
  },
  async ({ query, category }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);

    const res = await fetch(
      `${API_URL}/api/external/store?${params.toString()}`,
      {
        method: "GET",
        headers: { "x-api-key": API_KEY },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return {
        content: [
          { type: "text", text: `오류: ${err.error || res.statusText}` },
        ],
      };
    }

    const data = await res.json();
    const listings = data.listings;

    if (!listings || listings.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "검색 결과가 없습니다. 다른 검색어나 카테고리를 시도해 보세요.",
          },
        ],
      };
    }

    const list = listings
      .map(
        (l: {
          title: string;
          persona_name: string;
          description: string;
          category: string;
          price_krw: number;
          is_free: boolean;
          id: string;
        }) =>
          [
            `- **${l.title}** (${l.persona_name})`,
            `  카테고리: ${l.category} | 가격: ${l.is_free ? "무료" : `${l.price_krw.toLocaleString()}원`}`,
            `  ${l.description?.slice(0, 100) ?? ""}`,
            `  ID: ${l.id}`,
          ].join("\n")
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `스토어 검색 결과 (${listings.length}건):\n\n${list}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: 스토어 체험 (시식)
// ============================================================
server.tool(
  "store_preview",
  "스토어 페르소나를 시식(체험)합니다. 페르소나당 2회 무료 대화가 가능합니다.",
  {
    listing_id: z.string().describe("스토어 리스팅 ID"),
    message: z.string().describe("페르소나에게 보낼 메시지"),
  },
  async ({ listing_id, message }) => {
    const res = await fetch(
      `${API_URL}/api/external/store/${listing_id}/trial`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ message }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      if (res.status === 429) {
        return {
          content: [
            {
              type: "text",
              text: [
                "체험 횟수를 모두 사용했습니다.",
                "",
                err.disclaimer || "구매 후 무제한 대화가 가능합니다.",
              ].join("\n"),
            },
          ],
        };
      }
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
            data.response,
            "",
            `---`,
            `남은 체험 횟수: ${data.messages_remaining}회`,
            data.disclaimer,
          ].join("\n"),
        },
      ],
    };
  }
);

// ============================================================
// Tool: 구매한 페르소나 목록
// ============================================================
server.tool(
  "my_purchased_personas",
  "구매한 페르소나 목록을 조회합니다.",
  {},
  async () => {
    const res = await fetch(`${API_URL}/api/external/purchases`, {
      method: "GET",
      headers: { "x-api-key": API_KEY },
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
    const purchases = data.purchases;

    if (!purchases || purchases.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: [
              "구매한 페르소나가 없습니다.",
              "",
              "store_search로 스토어를 검색하고,",
              "store_preview로 체험한 후 구매할 수 있습니다.",
            ].join("\n"),
          },
        ],
      };
    }

    const list = purchases
      .map(
        (p: {
          persona_id: string;
          persona: { name: string; domain?: string; description?: string };
          amount_krw: number;
          created_at: string;
        }) =>
          [
            `- **${p.persona.name}** (${p.persona_id})`,
            p.persona.domain ? `  분야: ${p.persona.domain}` : "",
            p.persona.description
              ? `  ${p.persona.description.slice(0, 80)}`
              : "",
            `  구매일: ${p.created_at.slice(0, 10)} | ${p.amount_krw.toLocaleString()}원`,
          ]
            .filter(Boolean)
            .join("\n")
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: [
            `구매한 페르소나 목록 (${purchases.length}건):`,
            "",
            list,
            "",
            "chat 도구에 persona_id를 전달하면 대화할 수 있습니다.",
          ].join("\n"),
        },
      ],
    };
  }
);

// ============================================================
// Tool: 판단 자문
// ============================================================
server.tool(
  "consult_judgment",
  "전문가의 판단 프레임워크에 기반한 구조화된 판단 자문을 받습니다. 단순 chat과 달리 판단 축, If-Then 패턴, 경험 스토리를 기반으로 근거 있는 판단과 신뢰도를 제공합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    situation: z.string().describe("판단이 필요한 상황 설명"),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("추가 컨텍스트 (예: { expected_tps: 500, team_size: 4 })"),
    constraints: z
      .array(z.string())
      .optional()
      .describe("제약 조건 목록"),
  },
  async ({ persona_id, situation, context, constraints }) => {
    const res = await fetch(`${API_URL}/api/external/consult`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ persona_id, situation, context, constraints }),
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
    const axesInfo = data.applicable_axes
      ?.map((a: { name: string; weight: number }) => `  - ${a.name} (중요도: ${a.weight})`)
      .join("\n") ?? "";
    const patternsInfo = data.relevant_patterns
      ?.map((p: { condition: string; action: string }) => `  - IF ${p.condition} → THEN ${p.action}`)
      .join("\n") ?? "";
    const storyInfo = data.similar_story
      ? `\n관련 경험: ${data.similar_story.title}\n  ${data.similar_story.summary}`
      : "";
    const caveatsInfo = data.caveats?.length > 0
      ? `\n주의사항:\n${data.caveats.map((c: string) => `  - ${c}`).join("\n")}`
      : "";

    return {
      content: [
        {
          type: "text",
          text: [
            `판단: ${data.judgment}`,
            "",
            `근거: ${data.reasoning}`,
            "",
            axesInfo ? `적용된 판단 축:\n${axesInfo}` : "",
            patternsInfo ? `\n매칭된 패턴:\n${patternsInfo}` : "",
            storyInfo,
            `\n신뢰도: ${data.confidence}`,
            caveatsInfo,
          ].filter(Boolean).join("\n"),
        },
      ],
    };
  }
);

// ============================================================
// Tool: 프레임워크 조회
// ============================================================
server.tool(
  "get_framework",
  "전문가의 판단 프레임워크(판단 축, 핵심 패턴, 판단 철학)를 조회합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    domain: z
      .string()
      .optional()
      .describe("특정 도메인 필터 (예: '시스템 설계')"),
  },
  async ({ persona_id, domain }) => {
    const params = new URLSearchParams({ persona_id });
    if (domain) params.set("domain", domain);

    const res = await fetch(
      `${API_URL}/api/external/framework?${params.toString()}`,
      {
        method: "GET",
        headers: { "x-api-key": API_KEY },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return {
        content: [
          { type: "text", text: `오류: ${err.error || res.statusText}` },
        ],
      };
    }

    const data = await res.json();
    const axesList = data.axes
      ?.map((a: { name: string; weight: number; description?: string }) =>
        `- **${a.name}** (중요도: ${a.weight})${a.description ? `: ${a.description}` : ""}`
      )
      .join("\n") ?? "(없음)";
    const patternsList = data.key_patterns
      ?.map((p: { condition: string; action: string; reasoning?: string }) =>
        `- IF ${p.condition} → THEN ${p.action}${p.reasoning ? ` (${p.reasoning})` : ""}`
      )
      .join("\n") ?? "(없음)";

    return {
      content: [
        {
          type: "text",
          text: [
            data.philosophy ? `판단 철학: ${data.philosophy}` : "",
            data.domains?.length > 0 ? `도메인: ${data.domains.join(", ")}` : "",
            "",
            `판단 축:\n${axesList}`,
            "",
            `핵심 패턴:\n${patternsList}`,
          ].filter(Boolean).join("\n"),
        },
      ],
    };
  }
);

// ============================================================
// Tool: 유사 경험 검색
// ============================================================
server.tool(
  "find_similar_story",
  "전문가의 과거 경험 중 현재 상황과 유사한 스토리를 검색합니다. 경험에서 나온 교훈과 판단을 참고할 수 있습니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    query: z.string().describe("검색할 상황이나 키워드"),
  },
  async ({ persona_id, query }) => {
    const res = await fetch(`${API_URL}/api/external/stories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ persona_id, query }),
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
    const stories = data.stories;

    if (!stories || stories.length === 0) {
      return {
        content: [
          { type: "text", text: "관련 경험 스토리를 찾을 수 없습니다." },
        ],
      };
    }

    const list = stories
      .map(
        (s: {
          title: string;
          summary: string;
          context: string;
          decision: string;
          outcome?: string;
          lesson?: string;
          relevance: number;
        }) =>
          [
            `### ${s.title} (관련도: ${(s.relevance * 100).toFixed(0)}%)`,
            s.summary,
            `상황: ${s.context}`,
            `판단: ${s.decision}`,
            s.outcome ? `결과: ${s.outcome}` : "",
            s.lesson ? `교훈: ${s.lesson}` : "",
          ]
            .filter(Boolean)
            .join("\n")
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `관련 경험 스토리 (${stories.length}건):\n\n${list}`,
        },
      ],
    };
  }
);

// ============================================================
// Tool: 접근법 비교
// ============================================================
server.tool(
  "compare_approaches",
  "여러 접근법을 전문가의 판단 프레임워크 기반으로 비교 분석합니다. 각 접근법의 장단점과 판단 축 부합도를 제공합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    approaches: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe("비교할 접근법 목록 (2~5개)"),
    context: z
      .string()
      .optional()
      .describe("비교 상황 설명 (예: '세션 캐싱 용도, 일 100만 요청')"),
  },
  async ({ persona_id, approaches, context }) => {
    const res = await fetch(`${API_URL}/api/external/compare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ persona_id, approaches, context }),
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
    const perApproach = data.per_approach
      ?.map(
        (a: {
          name: string;
          pros: string[];
          cons: string[];
          risk_level: string;
        }) =>
          [
            `### ${a.name} (리스크: ${a.risk_level})`,
            `장점: ${a.pros?.join(", ") ?? "-"}`,
            `단점: ${a.cons?.join(", ") ?? "-"}`,
          ].join("\n")
      )
      .join("\n\n") ?? "";

    return {
      content: [
        {
          type: "text",
          text: [
            `추천: **${data.recommended}**`,
            "",
            `근거: ${data.reasoning}`,
            "",
            perApproach,
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
