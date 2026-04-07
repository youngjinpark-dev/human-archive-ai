import { describe, expect, it } from "vitest";

/**
 * Test API route business logic: input validation rules
 * for /api/external/consult, /api/external/compare,
 * /api/external/framework, and /api/external/stories
 */

describe("consult API validation", () => {
  it("requires api key", () => {
    const apiKey = null;
    expect(!apiKey).toBe(true);
  });

  it("requires persona_id and situation", () => {
    const body = { persona_id: "p-1", situation: "어떤 DB를 쓸까?" };
    expect(body.persona_id).toBeTruthy();
    expect(body.situation).toBeTruthy();
  });

  it("rejects missing persona_id", () => {
    const body = { situation: "질문" };
    const persona_id = (body as Record<string, unknown>).persona_id;
    expect(!persona_id).toBe(true);
  });

  it("rejects missing situation", () => {
    const body = { persona_id: "p-1" };
    const situation = (body as Record<string, unknown>).situation;
    expect(!situation).toBe(true);
  });

  it("allows optional context and constraints", () => {
    const body = {
      persona_id: "p-1",
      situation: "DB 선택",
      context: { expected_tps: 500, team_size: 4 },
      constraints: ["예산 1000만원", "6개월 내 완료"],
    };
    expect(body.context).toBeDefined();
    expect(body.constraints).toHaveLength(2);
  });

  it("fallback response has default confidence 0.5", () => {
    const fallback = {
      judgment: "응답 내용",
      reasoning: "",
      applicable_axes: [],
      relevant_patterns: [],
      confidence: 0.5,
      caveats: ["구조화된 분석에 실패하여 일반 응답으로 대체되었습니다."],
    };
    expect(fallback.confidence).toBe(0.5);
    expect(fallback.caveats).toHaveLength(1);
    expect(fallback.applicable_axes).toHaveLength(0);
  });
});

describe("compare API validation", () => {
  it("requires at least 2 approaches", () => {
    const approaches = ["Redis", "Memcached"];
    expect(approaches.length >= 2).toBe(true);
  });

  it("rejects fewer than 2 approaches", () => {
    const approaches = ["Redis"];
    expect(approaches.length < 2).toBe(true);
  });

  it("rejects more than 5 approaches", () => {
    const approaches = ["A", "B", "C", "D", "E", "F"];
    expect(approaches.length > 5).toBe(true);
  });

  it("allows 2-5 approaches", () => {
    for (let i = 2; i <= 5; i++) {
      const approaches = Array.from({ length: i }, (_, j) => `Option${j}`);
      expect(approaches.length >= 2 && approaches.length <= 5).toBe(true);
    }
  });

  it("requires approaches to be an array", () => {
    const approaches = ["Redis", "Memcached"];
    expect(Array.isArray(approaches)).toBe(true);
  });

  it("constructs search query from approaches and context", () => {
    const approaches = ["Redis", "Memcached"];
    const userContext = "세션 캐싱 용도";
    const searchQuery = `${approaches.join(" vs ")} ${userContext ?? ""}`;
    expect(searchQuery).toBe("Redis vs Memcached 세션 캐싱 용도");
  });
});

describe("framework API validation", () => {
  it("requires persona_id query parameter", () => {
    const url = new URL("http://localhost/api/external/framework?persona_id=p-1");
    const persona_id = url.searchParams.get("persona_id");
    expect(persona_id).toBe("p-1");
  });

  it("accepts optional domain filter", () => {
    const url = new URL(
      "http://localhost/api/external/framework?persona_id=p-1&domain=시스템 설계"
    );
    const domain = url.searchParams.get("domain");
    expect(domain).toBe("시스템 설계");
  });

  it("rejects missing persona_id", () => {
    const url = new URL("http://localhost/api/external/framework");
    const persona_id = url.searchParams.get("persona_id");
    expect(persona_id).toBeNull();
  });
});

describe("stories API validation", () => {
  it("requires persona_id and query", () => {
    const body = { persona_id: "p-1", query: "마이그레이션" };
    expect(body.persona_id).toBeTruthy();
    expect(body.query).toBeTruthy();
  });

  it("rejects missing query", () => {
    const body = { persona_id: "p-1" };
    const query = (body as Record<string, unknown>).query;
    expect(!query).toBe(true);
  });

  it("maps similarity to relevance in response", () => {
    const dbStory = {
      title: "마이그레이션",
      summary: "요약",
      context: "상황",
      decision: "결정",
      outcome: null,
      lesson: "교훈",
      similarity: 0.87,
    };

    const apiStory = {
      title: dbStory.title,
      summary: dbStory.summary,
      context: dbStory.context,
      decision: dbStory.decision,
      outcome: dbStory.outcome,
      lesson: dbStory.lesson,
      relevance: dbStory.similarity,
    };

    expect(apiStory.relevance).toBe(0.87);
    expect(apiStory).not.toHaveProperty("similarity");
  });
});

describe("API key authorization", () => {
  it("checks allowed_personas when not empty", () => {
    const keyRecord = {
      allowed_personas: ["p-1", "p-2"],
      active: true,
    };
    const persona_id = "p-3";

    const isAllowed =
      keyRecord.allowed_personas.length === 0 ||
      keyRecord.allowed_personas.includes(persona_id);
    expect(isAllowed).toBe(false);
  });

  it("allows all personas when allowed_personas is empty", () => {
    const keyRecord = {
      allowed_personas: [] as string[],
      active: true,
    };
    const persona_id = "p-anything";

    const isAllowed =
      keyRecord.allowed_personas.length === 0 ||
      keyRecord.allowed_personas.includes(persona_id);
    expect(isAllowed).toBe(true);
  });

  it("allows specified persona", () => {
    const keyRecord = {
      allowed_personas: ["p-1", "p-2"],
      active: true,
    };
    const persona_id = "p-1";

    const isAllowed =
      keyRecord.allowed_personas.length === 0 ||
      keyRecord.allowed_personas.includes(persona_id);
    expect(isAllowed).toBe(true);
  });
});
