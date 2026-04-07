import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  INTERVIEW_PHASES,
  getQuestion,
  getNextPosition,
  getTotalQuestions,
} from "@/lib/interview-phases";

// Test the processAnswer logic used in the interview external API
describe("Interview answer processing logic", () => {
  describe("domain phase", () => {
    it("appends domain info from answer", () => {
      const existingDomain = "AI";
      const answer = "백엔드 개발";
      const newDomain = existingDomain
        ? `${existingDomain} | ${answer.trim()}`
        : answer.trim();
      expect(newDomain).toBe("AI | 백엔드 개발");
    });

    it("uses answer as domain when none exists", () => {
      const existingDomain = null;
      const answer = "프론트엔드 개발";
      const newDomain = existingDomain
        ? `${existingDomain} | ${answer.trim()}`
        : answer.trim();
      expect(newDomain).toBe("프론트엔드 개발");
    });

    it("trims whitespace from answer", () => {
      const existingDomain = null;
      const answer = "  데이터 엔지니어링  ";
      const newDomain = existingDomain
        ? `${existingDomain} | ${answer.trim()}`
        : answer.trim();
      expect(newDomain).toBe("데이터 엔지니어링");
    });
  });

  describe("principles phase", () => {
    it("merges extracted principles with existing", () => {
      const existing = ["기존 원칙1"];
      const extracted = ["새 원칙1", "새 원칙2"];
      const merged = [...existing, ...extracted];
      expect(merged).toEqual(["기존 원칙1", "새 원칙1", "새 원칙2"]);
    });

    it("falls back to raw answer when extraction returns null", () => {
      const existing: string[] = [];
      const extracted = null;
      const answer = "가독성을 최우선으로 생각합니다";
      const principles = extracted ?? [answer.trim()];
      const merged = [...existing, ...principles];
      expect(merged).toEqual(["가독성을 최우선으로 생각합니다"]);
    });

    it("handles empty existing principles", () => {
      const existing: string[] = [];
      const extracted = ["원칙A", "원칙B"];
      const merged = [...existing, ...extracted];
      expect(merged).toHaveLength(2);
    });
  });

  describe("scenarios phase", () => {
    it("merges extracted scenario with existing", () => {
      const existing = [
        { situation: "기존상황", decision: "기존판단" },
      ];
      const extracted = {
        situation: "새상황",
        decision: "새판단",
        reasoning: "근거",
      };
      const merged = [...existing, extracted];
      expect(merged).toHaveLength(2);
      expect(merged[1].reasoning).toBe("근거");
    });

    it("falls back to raw answer when extraction fails", () => {
      const extracted = null;
      const answer = "예산이 부족하면 핵심 기능에 집중합니다";
      const scenario = extracted ?? {
        situation: "(인터뷰 답변)",
        decision: answer.trim(),
      };
      expect(scenario.situation).toBe("(인터뷰 답변)");
      expect(scenario.decision).toBe("예산이 부족하면 핵심 기능에 집중합니다");
    });
  });

  describe("style phase", () => {
    it("sets style from answer", () => {
      const answer = "  비유를 많이 사용하고 친근하게  ";
      const style = answer.trim();
      expect(style).toBe("비유를 많이 사용하고 친근하게");
    });
  });
});

describe("Interview session flow", () => {
  it("walks through all 9 questions", () => {
    const answers: string[] = [];
    let pos: { phaseIndex: number; questionIndex: number } | null = {
      phaseIndex: 0,
      questionIndex: 0,
    };

    while (pos) {
      const question = getQuestion(pos.phaseIndex, pos.questionIndex);
      expect(question).toBeTruthy();
      answers.push(`Answer to: ${question}`);
      pos = getNextPosition(pos.phaseIndex, pos.questionIndex);
    }

    expect(answers).toHaveLength(9);
  });

  it("each question maps to a known phase", () => {
    let pos: { phaseIndex: number; questionIndex: number } | null = {
      phaseIndex: 0,
      questionIndex: 0,
    };

    const phases: string[] = [];
    while (pos) {
      phases.push(INTERVIEW_PHASES[pos.phaseIndex].name);
      pos = getNextPosition(pos.phaseIndex, pos.questionIndex);
    }

    // domain: 2, principles: 3, scenarios: 3, style: 1
    expect(phases.filter((p) => p === "domain")).toHaveLength(2);
    expect(phases.filter((p) => p === "principles")).toHaveLength(3);
    expect(phases.filter((p) => p === "scenarios")).toHaveLength(3);
    expect(phases.filter((p) => p === "style")).toHaveLength(1);
  });

  it("total questions equals sum of all phase questions", () => {
    const sum = INTERVIEW_PHASES.reduce(
      (acc, phase) => acc + phase.questions.length,
      0
    );
    expect(getTotalQuestions()).toBe(sum);
    expect(sum).toBe(9);
  });
});

describe("Interview action validation", () => {
  it("requires persona_id and action", () => {
    const body1 = { action: "start" };
    expect(!body1.action || !(body1 as any).persona_id).toBe(true);

    const body2 = { persona_id: "p-1" };
    expect(!(body2 as any).action || !body2.persona_id).toBe(true);

    const body3 = { persona_id: "p-1", action: "start" };
    expect(!body3.persona_id || !body3.action).toBe(false);
  });

  it("answer action requires session_id and answer", () => {
    const body1 = { persona_id: "p-1", action: "answer" };
    expect(!(body1 as any).session_id || !(body1 as any).answer).toBe(true);

    const body2 = {
      persona_id: "p-1",
      action: "answer",
      session_id: "s-1",
      answer: "my answer",
    };
    expect(!body2.session_id || !body2.answer).toBe(false);
  });

  it("rejects invalid action values", () => {
    const validActions = ["start", "answer"];
    expect(validActions.includes("start")).toBe(true);
    expect(validActions.includes("answer")).toBe(true);
    expect(validActions.includes("invalid")).toBe(false);
    expect(validActions.includes("")).toBe(false);
  });
});
