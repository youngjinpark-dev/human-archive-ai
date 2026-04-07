import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/prompt";
import type { Persona } from "@/types";

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

describe("buildSystemPrompt", () => {
  it("includes persona name in identity", () => {
    const prompt = buildSystemPrompt(makePersona(), "");
    expect(prompt).toContain("김전문가");
  });

  it("includes domain when provided", () => {
    const prompt = buildSystemPrompt(
      makePersona({ domain: "백엔드 개발" }),
      ""
    );
    expect(prompt).toContain("백엔드 개발 분야 전문가");
  });

  it("excludes domain section when null", () => {
    const prompt = buildSystemPrompt(makePersona({ domain: null }), "");
    expect(prompt).not.toContain("분야 전문가");
  });

  it("includes description when provided", () => {
    const prompt = buildSystemPrompt(
      makePersona({ description: "10년 경력의 시니어 개발자" }),
      ""
    );
    expect(prompt).toContain("10년 경력의 시니어 개발자");
  });

  it("includes principles when provided", () => {
    const prompt = buildSystemPrompt(
      makePersona({ principles: ["코드 가독성 우선", "테스트 필수", "단순함"] }),
      ""
    );
    expect(prompt).toContain("핵심 판단 원칙");
    expect(prompt).toContain("1. 코드 가독성 우선");
    expect(prompt).toContain("2. 테스트 필수");
    expect(prompt).toContain("3. 단순함");
  });

  it("excludes principles section when empty", () => {
    const prompt = buildSystemPrompt(makePersona({ principles: [] }), "");
    expect(prompt).not.toContain("핵심 판단 원칙");
  });

  it("includes decision scenarios with reasoning", () => {
    const prompt = buildSystemPrompt(
      makePersona({
        decision_scenarios: [
          {
            situation: "레거시 코드 리팩토링",
            decision: "점진적으로 교체",
            reasoning: "서비스 안정성이 최우선",
          },
        ],
      }),
      ""
    );
    expect(prompt).toContain("의사결정 시나리오");
    expect(prompt).toContain("레거시 코드 리팩토링");
    expect(prompt).toContain("점진적으로 교체");
    expect(prompt).toContain("서비스 안정성이 최우선");
  });

  it("includes decision scenarios without reasoning", () => {
    const prompt = buildSystemPrompt(
      makePersona({
        decision_scenarios: [
          { situation: "긴급 배포", decision: "핫픽스 우선" },
        ],
      }),
      ""
    );
    expect(prompt).toContain("긴급 배포");
    expect(prompt).toContain("핫픽스 우선");
    expect(prompt).not.toContain("근거:");
  });

  it("includes style when provided", () => {
    const prompt = buildSystemPrompt(
      makePersona({ style: "비유를 많이 사용하며 친근한 말투" }),
      ""
    );
    expect(prompt).toContain("대화 스타일");
    expect(prompt).toContain("비유를 많이 사용하며 친근한 말투");
  });

  it("always includes rules section", () => {
    const prompt = buildSystemPrompt(makePersona(), "");
    expect(prompt).toContain("중요한 규칙");
    expect(prompt).toContain("판단 원칙과 의사결정 시나리오를 기반으로");
    expect(prompt).toContain("AI 페르소나임을 숨기지 마세요");
  });

  it("includes RAG context when provided", () => {
    const context = "[1] (test.mp3)\n이것은 참고 자료입니다.";
    const prompt = buildSystemPrompt(makePersona(), context);
    expect(prompt).toContain("보조 참고 자료");
    expect(prompt).toContain("이것은 참고 자료입니다.");
  });

  it("excludes RAG context section when empty placeholder", () => {
    const prompt = buildSystemPrompt(makePersona(), "(관련 자료 없음)");
    // The "## 보조 참고 자료" heading should not appear (it's mentioned in rules but not as a section)
    expect(prompt).not.toContain("## 보조 참고 자료");
  });

  it("excludes RAG context section when empty string", () => {
    const prompt = buildSystemPrompt(makePersona(), "");
    expect(prompt).not.toContain("## 보조 참고 자료");
  });

  it("builds complete prompt with all sections", () => {
    const persona = makePersona({
      name: "박교수",
      domain: "AI/ML",
      description: "20년차 교수",
      style: "학술적이지만 쉽게",
      principles: ["데이터 기반 판단", "재현 가능성"],
      decision_scenarios: [
        {
          situation: "모델 선택",
          decision: "정확도보다 해석 가능성 중시",
          reasoning: "비즈니스 신뢰 확보",
        },
      ],
    });
    const context = "[1] (lecture.mp3)\n딥러닝은 표현 학습입니다.";
    const prompt = buildSystemPrompt(persona, context);

    expect(prompt).toContain("박교수");
    expect(prompt).toContain("AI/ML 분야 전문가");
    expect(prompt).toContain("20년차 교수");
    expect(prompt).toContain("데이터 기반 판단");
    expect(prompt).toContain("모델 선택");
    expect(prompt).toContain("학술적이지만 쉽게");
    expect(prompt).toContain("딥러닝은 표현 학습입니다.");
  });
});
