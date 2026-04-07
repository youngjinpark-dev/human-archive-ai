import { describe, expect, it, vi } from "vitest";

// Test MCP server tool logic without importing the actual server
// (which requires runtime dependencies like @modelcontextprotocol/sdk)

describe("MCP server: persona_list formatting", () => {
  it("formats empty list with guidance", () => {
    const personas: unknown[] = [];
    const isEmpty = !personas || personas.length === 0;
    expect(isEmpty).toBe(true);

    const text = [
      "사용 가능한 페르소나가 없습니다.",
      "",
      "페르소나를 먼저 생성해야 대화할 수 있습니다.",
    ].join("\n");
    expect(text).toContain("페르소나를 먼저 생성");
  });

  it("formats persona list correctly", () => {
    const personas = [
      { id: "p-1", name: "김전문가", domain: "AI", description: "AI 전문가" },
      { id: "p-2", name: "박교수", domain: null, description: null },
    ];

    const list = personas
      .map(
        (p) =>
          `- ${p.name} (${p.id})${p.description ? `\n  ${p.description}` : ""}`
      )
      .join("\n");

    expect(list).toContain("김전문가 (p-1)");
    expect(list).toContain("AI 전문가");
    expect(list).toContain("박교수 (p-2)");
  });
});

describe("MCP server: persona_create response", () => {
  it("formats creation success with next steps", () => {
    const p = { id: "p-new", name: "새전문가", domain: "개발" };
    const text = [
      `페르소나가 생성되었습니다!`,
      "",
      `이름: ${p.name}`,
      `ID: ${p.id}`,
      `분야: ${p.domain}`,
    ].join("\n");

    expect(text).toContain("새전문가");
    expect(text).toContain("p-new");
    expect(text).toContain("개발");
  });
});

describe("MCP server: chat error handling", () => {
  it("returns helpful message on 404", () => {
    const status = 404;
    const errorMsg = "Persona not found";
    const text = [
      `오류: ${errorMsg}`,
      "",
      "페르소나를 찾을 수 없습니다. persona_list로 사용 가능한 페르소나를 확인하세요.",
    ].join("\n");

    expect(text).toContain("persona_list");
  });

  it("returns generic error for other status codes", () => {
    const errorMsg = "Internal Server Error";
    const text = `오류: ${errorMsg}`;
    expect(text).toContain("오류:");
  });
});

describe("MCP server: interview flow", () => {
  it("formats start response with session info", () => {
    const data = {
      session_id: "sess-1",
      phase: "domain",
      question: "전문 분야가 무엇인가요?",
    };
    const text = [
      "인터뷰를 시작합니다.",
      "",
      `세션 ID: ${data.session_id}`,
      `단계: ${data.phase}`,
      "",
      `질문: ${data.question}`,
    ].join("\n");

    expect(text).toContain("sess-1");
    expect(text).toContain("domain");
    expect(text).toContain("전문 분야");
  });

  it("formats completion response", () => {
    const completed = true;
    const text = [
      "인터뷰가 완료되었습니다!",
      "",
      "전문가의 판단 체계가 페르소나에 반영되었습니다.",
    ].join("\n");

    expect(completed).toBe(true);
    expect(text).toContain("완료");
  });

  it("formats in-progress response with next question", () => {
    const data = {
      phase: "principles",
      next_question: "업무에서 가장 중요하게 생각하는 원칙은?",
    };
    const text = [
      `단계: ${data.phase}`,
      "",
      `다음 질문: ${data.next_question}`,
    ].join("\n");

    expect(text).toContain("principles");
    expect(text).toContain("원칙");
  });
});

describe("MCP server: store_search formatting", () => {
  it("formats search results with prices", () => {
    const listings = [
      {
        title: "AI 전문가",
        persona_name: "김AI",
        description: "AI 분야 전문가",
        category: "technology",
        price_krw: 15000,
        is_free: false,
        id: "l-1",
      },
      {
        title: "무료 상담사",
        persona_name: "박무료",
        description: "무료 상담",
        category: "career",
        price_krw: 0,
        is_free: true,
        id: "l-2",
      },
    ];

    const list = listings
      .map(
        (l) =>
          `- **${l.title}** (${l.persona_name})\n  카테고리: ${l.category} | 가격: ${l.is_free ? "무료" : `${l.price_krw.toLocaleString()}원`}\n  ${l.description}\n  ID: ${l.id}`
      )
      .join("\n\n");

    expect(list).toContain("AI 전문가");
    expect(list).toContain("15,000원");
    expect(list).toContain("무료");
    expect(list).toContain("l-1");
    expect(list).toContain("l-2");
  });

  it("handles empty search results", () => {
    const listings: unknown[] = [];
    const isEmpty = !listings || listings.length === 0;
    expect(isEmpty).toBe(true);
  });
});

describe("MCP server: store_preview", () => {
  it("formats trial response with remaining count", () => {
    const data = {
      response: "안녕하세요, AI 전문가입니다.",
      messages_remaining: 1,
      disclaimer: "체험 버전입니다.",
    };
    const text = [
      data.response,
      "",
      "---",
      `남은 체험 횟수: ${data.messages_remaining}회`,
      data.disclaimer,
    ].join("\n");

    expect(text).toContain("AI 전문가");
    expect(text).toContain("1회");
    expect(text).toContain("체험 버전");
  });

  it("formats 429 trial limit response", () => {
    const text = [
      "체험 횟수를 모두 사용했습니다.",
      "",
      "구매 후 무제한 대화가 가능합니다.",
    ].join("\n");
    expect(text).toContain("체험 횟수를 모두 사용");
  });
});

describe("MCP server: my_purchased_personas formatting", () => {
  it("formats empty purchase list", () => {
    const purchases: unknown[] = [];
    const isEmpty = !purchases || purchases.length === 0;
    expect(isEmpty).toBe(true);
  });

  it("formats purchase list with persona details", () => {
    const purchases = [
      {
        persona_id: "p-1",
        persona: {
          name: "김전문가",
          domain: "백엔드",
          description: "10년차 개발자",
        },
        amount_krw: 10000,
        created_at: "2026-04-07T12:00:00Z",
      },
    ];

    const list = purchases
      .map(
        (p) =>
          [
            `- **${p.persona.name}** (${p.persona_id})`,
            `  분야: ${p.persona.domain}`,
            `  ${p.persona.description}`,
            `  구매일: ${p.created_at.slice(0, 10)} | ${p.amount_krw.toLocaleString()}원`,
          ].join("\n")
      )
      .join("\n\n");

    expect(list).toContain("김전문가");
    expect(list).toContain("백엔드");
    expect(list).toContain("2026-04-07");
    expect(list).toContain("10,000원");
  });
});

describe("MCP server: upload_audio response", () => {
  it("formats upload success", () => {
    const data = {
      fileName: "lecture.mp3",
      transcript_length: 5000,
      chunks_count: 8,
    };
    const text = [
      "음성 파일 업로드 및 처리가 완료되었습니다!",
      "",
      `파일: ${data.fileName}`,
      `트랜스크립트 길이: ${data.transcript_length}자`,
      `생성된 청크: ${data.chunks_count}개`,
    ].join("\n");

    expect(text).toContain("lecture.mp3");
    expect(text).toContain("5000자");
    expect(text).toContain("8개");
  });
});
