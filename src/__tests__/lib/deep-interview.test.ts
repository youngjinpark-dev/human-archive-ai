import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtractionResult } from "@/types";

// Mock dependencies
const mockChat = vi.fn();
const mockExtractJudgmentPatterns = vi.fn();

vi.mock("@/lib/llm", () => ({
  chat: (...args: unknown[]) => mockChat(...args),
}));

vi.mock("@/lib/judgment-extractor", () => ({
  extractJudgmentPatterns: (...args: unknown[]) => mockExtractJudgmentPatterns(...args),
}));

const {
  DEEP_SEED_QUESTIONS,
  MAX_DEEP_QUESTIONS,
  calculateSaturation,
  determinePhase,
  generateNextQuestion,
  extractFromAnswer,
} = await import("@/lib/deep-interview");

describe("DEEP_SEED_QUESTIONS", () => {
  it("has 2 seed questions", () => {
    expect(DEEP_SEED_QUESTIONS).toHaveLength(2);
  });

  it("first question asks about domain/experience", () => {
    expect(DEEP_SEED_QUESTIONS[0]).toContain("전문 분야");
  });

  it("second question asks about what's most important", () => {
    expect(DEEP_SEED_QUESTIONS[1]).toContain("가장 중요");
  });
});

describe("MAX_DEEP_QUESTIONS", () => {
  it("is 30", () => {
    expect(MAX_DEEP_QUESTIONS).toBe(30);
  });
});

describe("calculateSaturation", () => {
  function makeExtraction(
    newAxes = 0,
    newPatterns = 0,
    newStories = 0
  ): ExtractionResult {
    return {
      newAxes: Array(newAxes).fill({ name: "a", description: "", weight: 0.5, domain: null }),
      reinforcedAxes: [],
      newPatterns: Array(newPatterns).fill({ condition: "c", action: "a", reasoning: "" }),
      newStories: Array(newStories).fill({
        title: "t",
        summary: "",
        context: "c",
        decision: "d",
        outcome: null,
        lesson: null,
      }),
    };
  }

  it("returns 0 when fewer extractions than window size", () => {
    expect(calculateSaturation([makeExtraction(1)])).toBe(0);
    expect(calculateSaturation([makeExtraction(1), makeExtraction(1)])).toBe(0);
  });

  it("returns 1.0 when no new items in window", () => {
    const extractions = [
      makeExtraction(0, 0, 0),
      makeExtraction(0, 0, 0),
      makeExtraction(0, 0, 0),
    ];
    expect(calculateSaturation(extractions)).toBe(1.0);
  });

  it("returns 0.7 when 1-2 new items in window", () => {
    const extractions = [
      makeExtraction(1, 0, 0),
      makeExtraction(0, 0, 0),
      makeExtraction(0, 0, 0),
    ];
    expect(calculateSaturation(extractions)).toBe(0.7);
  });

  it("returns 0.3 when 3-5 new items in window", () => {
    const extractions = [
      makeExtraction(1, 1, 0),
      makeExtraction(0, 1, 0),
      makeExtraction(0, 0, 1),
    ];
    expect(calculateSaturation(extractions)).toBe(0.3);
  });

  it("returns 0 when many new items in window", () => {
    const extractions = [
      makeExtraction(2, 2, 2),
      makeExtraction(1, 1, 0),
      makeExtraction(0, 0, 0),
    ];
    expect(calculateSaturation(extractions)).toBe(0);
  });

  it("uses only last N items for window", () => {
    const extractions = [
      makeExtraction(5, 5, 5), // old, outside window
      makeExtraction(0, 0, 0),
      makeExtraction(0, 0, 0),
      makeExtraction(0, 0, 0),
    ];
    expect(calculateSaturation(extractions)).toBe(1.0);
  });

  it("accepts custom window size", () => {
    const extractions = [
      makeExtraction(0, 0, 0),
      makeExtraction(0, 0, 0),
    ];
    expect(calculateSaturation(extractions, 2)).toBe(1.0);
  });
});

describe("determinePhase", () => {
  it("returns seed when answers < seed questions count", () => {
    expect(determinePhase(0, 0)).toBe("seed");
    expect(determinePhase(1, 0)).toBe("seed");
  });

  it("returns deep_dive when saturation is low", () => {
    expect(determinePhase(5, 0)).toBe("deep_dive");
    expect(determinePhase(5, 0.3)).toBe("deep_dive");
    expect(determinePhase(10, 0.5)).toBe("deep_dive");
  });

  it("returns cross_validation when saturation >= 0.7 but < 1.0", () => {
    expect(determinePhase(5, 0.7)).toBe("cross_validation");
    expect(determinePhase(10, 0.8)).toBe("cross_validation");
    expect(determinePhase(10, 0.9)).toBe("cross_validation");
  });

  it("returns confirmation when saturation >= 1.0", () => {
    expect(determinePhase(5, 1.0)).toBe("confirmation");
    expect(determinePhase(20, 1.0)).toBe("confirmation");
  });

  it("seed phase takes priority over saturation", () => {
    expect(determinePhase(0, 1.0)).toBe("seed");
    expect(determinePhase(1, 1.0)).toBe("seed");
  });
});

describe("generateNextQuestion", () => {
  beforeEach(() => {
    mockChat.mockReset();
  });

  it("parses valid JSON response from LLM", async () => {
    mockChat.mockResolvedValue(
      '{"question": "왜 확장성을 중시하나요?", "intent": "explore_why", "target_axis": "확장성"}'
    );

    const result = await generateNextQuestion({
      answers: [{ question: "Q1", answer: "A1" }],
      axes: [],
      patterns: [],
      stories: [],
      saturation: 0,
    });

    expect(result.question).toBe("왜 확장성을 중시하나요?");
    expect(result.intent).toBe("explore_why");
    expect(result.targetAxis).toBe("확장성");
  });

  it("returns fallback on invalid JSON", async () => {
    mockChat.mockResolvedValue("이건 JSON이 아닙니다");

    const result = await generateNextQuestion({
      answers: [],
      axes: [],
      patterns: [],
      stories: [],
      saturation: 0,
    });

    expect(result.question).toContain("판단 경험");
    expect(result.intent).toBe("discover_story");
    expect(result.targetAxis).toBeNull();
  });

  it("defaults invalid intent to explore_why", async () => {
    mockChat.mockResolvedValue(
      '{"question": "질문", "intent": "invalid_intent", "target_axis": null}'
    );

    const result = await generateNextQuestion({
      answers: [],
      axes: [],
      patterns: [],
      stories: [],
      saturation: 0,
    });

    expect(result.intent).toBe("explore_why");
  });

  it("handles JSON embedded in text", async () => {
    mockChat.mockResolvedValue(
      '다음 질문입니다: {"question": "어떻게 우선순위를 정하나요?", "intent": "explore_how", "target_axis": null} 이상입니다.'
    );

    const result = await generateNextQuestion({
      answers: [],
      axes: [],
      patterns: [],
      stories: [],
      saturation: 0,
    });

    expect(result.question).toBe("어떻게 우선순위를 정하나요?");
    expect(result.intent).toBe("explore_how");
  });

  it("includes framework summary in system prompt", async () => {
    mockChat.mockResolvedValue(
      '{"question": "Q", "intent": "explore_why", "target_axis": null}'
    );

    await generateNextQuestion({
      answers: [],
      axes: [{ id: "a1", framework_id: "f1", name: "확장성", description: null, weight: 0.9, domain: null, evidence_count: 1, created_at: "" }],
      patterns: [{ id: "p1", framework_id: "f1", condition: "IF X", action: "THEN Y", reasoning: null, axis_id: null, confidence: 0.8, source_type: "interview", source_id: null, created_at: "" }],
      stories: [{ id: "s1", framework_id: "f1", title: "스토리1", summary: "", context: "", decision: "", outcome: null, lesson: null, related_axes: [], source_type: "interview", source_id: null, created_at: "" }],
      saturation: 0.3,
    });

    const systemPrompt = mockChat.mock.calls[0][0];
    expect(systemPrompt).toContain("확장성");
    expect(systemPrompt).toContain("IF X");
    expect(systemPrompt).toContain("스토리1");
  });
});

describe("extractFromAnswer", () => {
  beforeEach(() => {
    mockExtractJudgmentPatterns.mockReset();
  });

  it("combines question and answer as text", async () => {
    const mockResult: ExtractionResult = {
      newAxes: [],
      reinforcedAxes: [],
      newPatterns: [],
      newStories: [],
    };
    mockExtractJudgmentPatterns.mockResolvedValue(mockResult);

    await extractFromAnswer("질문입니다", "답변입니다", ["기존축"]);

    expect(mockExtractJudgmentPatterns).toHaveBeenCalledWith(
      "질문: 질문입니다\n답변: 답변입니다",
      ["기존축"]
    );
  });

  it("passes existing axes names for deduplication", async () => {
    mockExtractJudgmentPatterns.mockResolvedValue({
      newAxes: [],
      reinforcedAxes: [],
      newPatterns: [],
      newStories: [],
    });

    await extractFromAnswer("Q", "A", ["확장성", "안정성"]);

    expect(mockExtractJudgmentPatterns.mock.calls[0][1]).toEqual([
      "확장성",
      "안정성",
    ]);
  });
});
