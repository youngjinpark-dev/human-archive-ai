import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtractionResult } from "@/types";

// Mock LLM extract
const mockExtract = vi.fn();
vi.mock("@/lib/llm", () => ({
  extract: (...args: unknown[]) => mockExtract(...args),
}));

const { extractJudgmentPatterns } = await import("@/lib/judgment-extractor");

describe("extractJudgmentPatterns", () => {
  beforeEach(() => {
    mockExtract.mockReset();
  });

  it("classifies new axes when no existing axes", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        return [
          { name: "확장성", description: "시스템 확장 가능성", weight: 0.9, domain: null },
        ];
      }
      if (prompt.includes("판단 패턴")) return [];
      if (prompt.includes("경험 스토리")) return [];
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newAxes).toHaveLength(1);
    expect(result.newAxes[0].name).toBe("확장성");
    expect(result.reinforcedAxes).toHaveLength(0);
  });

  it("classifies reinforced axes when matching existing", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        return [
          { name: "확장성", description: "추가 근거", weight: 0.8, domain: null },
        ];
      }
      if (prompt.includes("판단 패턴")) return [];
      if (prompt.includes("경험 스토리")) return [];
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", ["확장성"]);
    expect(result.newAxes).toHaveLength(0);
    expect(result.reinforcedAxes).toHaveLength(1);
    expect(result.reinforcedAxes[0].axisName).toBe("확장성");
    expect(result.reinforcedAxes[0].newEvidence).toBe("추가 근거");
  });

  it("matches axes by substring inclusion", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        return [
          { name: "확장", description: "부분 매치", weight: 0.7, domain: null },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", ["확장성"]);
    expect(result.reinforcedAxes).toHaveLength(1);
    expect(result.reinforcedAxes[0].axisName).toBe("확장성");
  });

  it("extracts patterns with condition and action", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) return [];
      if (prompt.includes("판단 패턴")) {
        return [
          { condition: "팀 규모 5명 미만", action: "익숙한 기술 선택", reasoning: "학습 비용" },
          { condition: "", action: "무효 패턴", reasoning: "" },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newPatterns).toHaveLength(1);
    expect(result.newPatterns[0].condition).toBe("팀 규모 5명 미만");
    expect(result.newPatterns[0].action).toBe("익숙한 기술 선택");
  });

  it("filters out patterns without condition or action", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 패턴")) {
        return [
          { condition: "조건만", action: "", reasoning: "" },
          { condition: "", action: "행동만", reasoning: "" },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newPatterns).toHaveLength(0);
  });

  it("extracts stories with required fields", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("경험 스토리")) {
        return [
          {
            title: "대규모 마이그레이션",
            summary: "요약",
            context: "레거시 시스템",
            decision: "점진적 이관",
            outcome: "성공",
            lesson: "작은 단위로",
          },
          { title: "불완전", summary: "", context: "", decision: "", outcome: null, lesson: null },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newStories).toHaveLength(1);
    expect(result.newStories[0].title).toBe("대규모 마이그레이션");
    expect(result.newStories[0].outcome).toBe("성공");
  });

  it("filters stories missing title, context, or decision", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("경험 스토리")) {
        return [
          { title: "", summary: "", context: "있음", decision: "있음", outcome: null, lesson: null },
          { title: "있음", summary: "", context: "", decision: "있음", outcome: null, lesson: null },
          { title: "있음", summary: "", context: "있음", decision: "", outcome: null, lesson: null },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newStories).toHaveLength(0);
  });

  it("clamps weight to 0~1 range", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        return [
          { name: "높은값", description: "", weight: 1.5, domain: null },
          { name: "낮은값", description: "", weight: -0.3, domain: null },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newAxes[0].weight).toBe(1);
    expect(result.newAxes[1].weight).toBe(0);
  });

  it("defaults weight to 0.5 when undefined", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        return [
          { name: "기본값", description: "", weight: undefined, domain: null },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newAxes[0].weight).toBe(0.5);
  });

  it("handles non-array LLM responses gracefully", async () => {
    mockExtract.mockResolvedValue("invalid response");

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newAxes).toHaveLength(0);
    expect(result.newPatterns).toHaveLength(0);
    expect(result.newStories).toHaveLength(0);
  });

  it("handles null LLM responses", async () => {
    mockExtract.mockResolvedValue(null);

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newAxes).toHaveLength(0);
    expect(result.reinforcedAxes).toHaveLength(0);
    expect(result.newPatterns).toHaveLength(0);
    expect(result.newStories).toHaveLength(0);
  });

  it("skips axes without name", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        return [
          { name: "", description: "이름없음", weight: 0.5, domain: null },
          { name: "유효", description: "유효축", weight: 0.5, domain: null },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newAxes).toHaveLength(1);
    expect(result.newAxes[0].name).toBe("유효");
  });

  it("includes context hint for existing axes", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        expect(prompt).toContain("기존 판단 축: 확장성, 안정성");
        return [];
      }
      return [];
    });

    await extractJudgmentPatterns("텍스트", ["확장성", "안정성"]);
  });

  it("defaults null description/reasoning fields", async () => {
    mockExtract.mockImplementation((_text: string, prompt: string) => {
      if (prompt.includes("판단 축")) {
        return [
          { name: "축", description: null, weight: 0.5, domain: null },
        ];
      }
      if (prompt.includes("판단 패턴")) {
        return [
          { condition: "조건", action: "행동", reasoning: null },
        ];
      }
      if (prompt.includes("경험 스토리")) {
        return [
          { title: "제목", summary: null, context: "상황", decision: "결정", outcome: null, lesson: null },
        ];
      }
      return [];
    });

    const result = await extractJudgmentPatterns("텍스트", []);
    expect(result.newAxes[0].description).toBe("");
    expect(result.newPatterns[0].reasoning).toBe("");
    expect(result.newStories[0].summary).toBe("");
  });
});
