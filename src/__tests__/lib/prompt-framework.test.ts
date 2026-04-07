import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/prompt";
import type { Persona, FrameworkData, JudgmentFramework, JudgmentAxis, IfThenPattern } from "@/types";

function makePersona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: "p-1",
    user_id: "u-1",
    name: "김전문가",
    domain: null,
    description: null,
    style: null,
    principles: [],
    decision_scenarios: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFramework(overrides: Partial<JudgmentFramework> = {}): JudgmentFramework {
  return {
    id: "f-1",
    persona_id: "p-1",
    philosophy: null,
    domains: [],
    version: 1,
    status: "ready",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeAxis(overrides: Partial<JudgmentAxis> = {}): JudgmentAxis {
  return {
    id: "a-1",
    framework_id: "f-1",
    name: "확장성",
    description: "시스템 확장 가능성",
    weight: 0.9,
    domain: null,
    evidence_count: 3,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePattern(overrides: Partial<IfThenPattern> = {}): IfThenPattern {
  return {
    id: "pt-1",
    framework_id: "f-1",
    condition: "팀 규모 5명 미만",
    action: "익숙한 기술 선택",
    reasoning: "학습 비용 감소",
    axis_id: null,
    confidence: 0.85,
    source_type: "interview",
    source_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildSystemPrompt with frameworkData", () => {
  it("includes philosophy when provided", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework({ philosophy: "항상 사용자 가치를 최우선으로" }),
      axes: [],
      patterns: [],
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    expect(prompt).toContain("판단 철학");
    expect(prompt).toContain("항상 사용자 가치를 최우선으로");
  });

  it("excludes philosophy section when null", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework({ philosophy: null }),
      axes: [],
      patterns: [],
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    expect(prompt).not.toContain("판단 철학");
  });

  it("includes judgment axes sorted by weight", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [
        makeAxis({ name: "안정성", weight: 0.7 }),
        makeAxis({ name: "확장성", weight: 0.9, id: "a-2" }),
      ],
      patterns: [],
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    expect(prompt).toContain("판단 축");
    expect(prompt).toContain("확장성");
    expect(prompt).toContain("안정성");
    // 확장성 (0.9) should appear before 안정성 (0.7)
    const posScale = prompt.indexOf("확장성");
    const posStability = prompt.indexOf("안정성");
    expect(posScale).toBeLessThan(posStability);
  });

  it("includes if-then patterns sorted by confidence", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns: [
        makePattern({ condition: "데드라인 촉박", action: "MVP 우선", confidence: 0.6, id: "pt-2" }),
        makePattern({ condition: "팀 규모 큰 경우", action: "문서화 강화", confidence: 0.95, id: "pt-3" }),
      ],
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    expect(prompt).toContain("핵심 판단 패턴");
    expect(prompt).toContain("IF 팀 규모 큰 경우");
    expect(prompt).toContain("THEN 문서화 강화");
    // Higher confidence first
    const posHigh = prompt.indexOf("팀 규모 큰 경우");
    const posLow = prompt.indexOf("데드라인 촉박");
    expect(posHigh).toBeLessThan(posLow);
  });

  it("includes reasoning in patterns when available", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns: [makePattern({ reasoning: "학습 비용 감소" })],
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    expect(prompt).toContain("근거: 학습 비용 감소");
  });

  it("excludes reasoning when null", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns: [makePattern({ reasoning: null })],
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    expect(prompt).not.toContain("근거:");
  });

  it("uses framework-specific rules when frameworkData present", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns: [],
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    expect(prompt).toContain("판단 축과 패턴을 기반으로 구조화된 판단");
    expect(prompt).not.toContain("판단 원칙과 의사결정 시나리오를 기반으로");
  });

  it("uses classic rules when no frameworkData", () => {
    const prompt = buildSystemPrompt(makePersona(), "");
    expect(prompt).toContain("판단 원칙과 의사결정 시나리오를 기반으로");
    expect(prompt).not.toContain("판단 축과 패턴을 기반으로 구조화된 판단");
  });

  it("excludes principles/scenarios when frameworkData present", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns: [],
    };
    const persona = makePersona({
      principles: ["원칙1"],
      decision_scenarios: [{ situation: "상황", decision: "결정" }],
    });
    const prompt = buildSystemPrompt(persona, "", frameworkData);
    expect(prompt).not.toContain("핵심 판단 원칙");
    expect(prompt).not.toContain("의사결정 시나리오");
  });

  it("limits patterns to 15", () => {
    const patterns = Array.from({ length: 20 }, (_, i) =>
      makePattern({
        id: `pt-${i}`,
        condition: `조건${i}`,
        action: `행동${i}`,
        confidence: 0.5 + i * 0.02,
      })
    );
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns,
    };
    const prompt = buildSystemPrompt(makePersona(), "", frameworkData);
    // Should have at most 15 IF patterns
    const ifCount = (prompt.match(/IF /g) || []).length;
    expect(ifCount).toBeLessThanOrEqual(15);
  });

  it("still includes style with framework", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns: [],
    };
    const prompt = buildSystemPrompt(
      makePersona({ style: "간결하고 직설적" }),
      "",
      frameworkData
    );
    expect(prompt).toContain("대화 스타일");
    expect(prompt).toContain("간결하고 직설적");
  });

  it("still includes RAG context with framework", () => {
    const frameworkData: FrameworkData = {
      framework: makeFramework(),
      axes: [],
      patterns: [],
    };
    const prompt = buildSystemPrompt(
      makePersona(),
      "[1] (audio.mp3)\n참고 내용입니다.",
      frameworkData
    );
    expect(prompt).toContain("보조 참고 자료");
    expect(prompt).toContain("참고 내용입니다.");
  });
});
