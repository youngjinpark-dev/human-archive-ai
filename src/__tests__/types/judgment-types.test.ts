import { describe, expect, it } from "vitest";
import type {
  JudgmentFramework,
  JudgmentAxis,
  IfThenPattern,
  ExperienceStory,
  QuestionIntent,
  ExtractionResult,
  FrameworkData,
} from "@/types";

describe("Judgment Framework types", () => {
  describe("JudgmentFramework", () => {
    it("supports all status values", () => {
      const statuses: JudgmentFramework["status"][] = [
        "building",
        "ready",
        "archived",
      ];
      expect(statuses).toHaveLength(3);
    });

    it("supports full framework with all fields", () => {
      const framework: JudgmentFramework = {
        id: "f-1",
        persona_id: "p-1",
        philosophy: "사용자 가치 최우선",
        domains: ["백엔드", "인프라"],
        version: 2,
        status: "ready",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      expect(framework.philosophy).toBe("사용자 가치 최우선");
      expect(framework.domains).toHaveLength(2);
      expect(framework.version).toBe(2);
    });

    it("supports nullable philosophy", () => {
      const framework: JudgmentFramework = {
        id: "f-1",
        persona_id: "p-1",
        philosophy: null,
        domains: [],
        version: 1,
        status: "building",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      expect(framework.philosophy).toBeNull();
    });
  });

  describe("JudgmentAxis", () => {
    it("supports full axis with all fields", () => {
      const axis: JudgmentAxis = {
        id: "a-1",
        framework_id: "f-1",
        name: "확장성",
        description: "시스템 확장 가능성",
        weight: 0.9,
        domain: "인프라",
        evidence_count: 5,
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(axis.weight).toBe(0.9);
      expect(axis.evidence_count).toBe(5);
    });

    it("supports nullable description and domain", () => {
      const axis: JudgmentAxis = {
        id: "a-1",
        framework_id: "f-1",
        name: "범용 축",
        description: null,
        weight: 0.5,
        domain: null,
        evidence_count: 0,
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(axis.description).toBeNull();
      expect(axis.domain).toBeNull();
    });
  });

  describe("IfThenPattern", () => {
    it("supports all source types", () => {
      const sources: IfThenPattern["source_type"][] = [
        "interview",
        "audio",
        "manual",
      ];
      expect(sources).toHaveLength(3);
    });

    it("supports full pattern", () => {
      const pattern: IfThenPattern = {
        id: "pt-1",
        framework_id: "f-1",
        condition: "팀 규모 5명 미만",
        action: "익숙한 기술 선택",
        reasoning: "학습 비용 감소",
        axis_id: "a-1",
        confidence: 0.85,
        source_type: "interview",
        source_id: "s-1",
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(pattern.confidence).toBe(0.85);
      expect(pattern.axis_id).toBe("a-1");
    });

    it("supports nullable fields", () => {
      const pattern: IfThenPattern = {
        id: "pt-1",
        framework_id: "f-1",
        condition: "조건",
        action: "행동",
        reasoning: null,
        axis_id: null,
        confidence: 0.5,
        source_type: "manual",
        source_id: null,
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(pattern.reasoning).toBeNull();
      expect(pattern.axis_id).toBeNull();
    });
  });

  describe("ExperienceStory", () => {
    it("supports all source types", () => {
      const sources: ExperienceStory["source_type"][] = [
        "interview",
        "audio",
        "manual",
      ];
      expect(sources).toHaveLength(3);
    });

    it("supports full story", () => {
      const story: ExperienceStory = {
        id: "es-1",
        framework_id: "f-1",
        title: "대규모 마이그레이션",
        summary: "요약",
        context: "레거시 시스템",
        decision: "점진적 이관",
        outcome: "성공",
        lesson: "작은 단위로 진행",
        related_axes: ["a-1", "a-2"],
        embedding: [0.1, 0.2, 0.3],
        source_type: "interview",
        source_id: "s-1",
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(story.related_axes).toHaveLength(2);
      expect(story.embedding).toHaveLength(3);
    });

    it("supports nullable fields", () => {
      const story: ExperienceStory = {
        id: "es-1",
        framework_id: "f-1",
        title: "제목",
        summary: "요약",
        context: "상황",
        decision: "결정",
        outcome: null,
        lesson: null,
        related_axes: [],
        source_type: "audio",
        source_id: null,
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(story.outcome).toBeNull();
      expect(story.lesson).toBeNull();
      expect(story.embedding).toBeUndefined();
    });
  });

  describe("QuestionIntent", () => {
    it("supports all intent values", () => {
      const intents: QuestionIntent[] = [
        "explore_why",
        "explore_how",
        "explore_what_if",
        "discover_story",
        "cross_validate",
        "confirm",
      ];
      expect(intents).toHaveLength(6);
    });
  });

  describe("ExtractionResult", () => {
    it("supports complete extraction result", () => {
      const result: ExtractionResult = {
        newAxes: [
          { name: "확장성", description: "설명", weight: 0.9, domain: null },
        ],
        reinforcedAxes: [
          { axisName: "안정성", newEvidence: "추가 근거" },
        ],
        newPatterns: [
          { condition: "조건", action: "행동", reasoning: "이유" },
        ],
        newStories: [
          {
            title: "제목",
            summary: "요약",
            context: "상황",
            decision: "결정",
            outcome: "결과",
            lesson: "교훈",
          },
        ],
      };
      expect(result.newAxes).toHaveLength(1);
      expect(result.reinforcedAxes).toHaveLength(1);
      expect(result.newPatterns).toHaveLength(1);
      expect(result.newStories).toHaveLength(1);
    });

    it("supports empty extraction result", () => {
      const result: ExtractionResult = {
        newAxes: [],
        reinforcedAxes: [],
        newPatterns: [],
        newStories: [],
      };
      expect(result.newAxes).toHaveLength(0);
    });
  });

  describe("FrameworkData", () => {
    it("bundles framework with axes and patterns", () => {
      const data: FrameworkData = {
        framework: {
          id: "f-1",
          persona_id: "p-1",
          philosophy: "철학",
          domains: [],
          version: 1,
          status: "ready",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        axes: [
          {
            id: "a-1",
            framework_id: "f-1",
            name: "축",
            description: null,
            weight: 0.5,
            domain: null,
            evidence_count: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        patterns: [],
      };
      expect(data.framework.status).toBe("ready");
      expect(data.axes).toHaveLength(1);
      expect(data.patterns).toHaveLength(0);
    });
  });
});
