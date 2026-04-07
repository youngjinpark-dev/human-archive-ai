import { describe, expect, it } from "vitest";
import {
  INTERVIEW_PHASES,
  getTotalQuestions,
  getQuestion,
  getNextPosition,
} from "@/lib/interview-phases";

describe("INTERVIEW_PHASES", () => {
  it("has 4 phases", () => {
    expect(INTERVIEW_PHASES).toHaveLength(4);
  });

  it("phases are in correct order", () => {
    expect(INTERVIEW_PHASES[0].name).toBe("domain");
    expect(INTERVIEW_PHASES[1].name).toBe("principles");
    expect(INTERVIEW_PHASES[2].name).toBe("scenarios");
    expect(INTERVIEW_PHASES[3].name).toBe("style");
  });

  it("domain phase has 2 questions", () => {
    expect(INTERVIEW_PHASES[0].questions).toHaveLength(2);
  });

  it("principles phase has 3 questions", () => {
    expect(INTERVIEW_PHASES[1].questions).toHaveLength(3);
  });

  it("scenarios phase has 3 questions", () => {
    expect(INTERVIEW_PHASES[2].questions).toHaveLength(3);
  });

  it("style phase has 1 question", () => {
    expect(INTERVIEW_PHASES[3].questions).toHaveLength(1);
  });
});

describe("getTotalQuestions", () => {
  it("returns 9 (2+3+3+1)", () => {
    expect(getTotalQuestions()).toBe(9);
  });
});

describe("getQuestion", () => {
  it("returns first question for (0, 0)", () => {
    const q = getQuestion(0, 0);
    expect(q).toBeTruthy();
    expect(q).toContain("전문 분야");
  });

  it("returns second question for (0, 1)", () => {
    const q = getQuestion(0, 1);
    expect(q).toBeTruthy();
    expect(q).toContain("강점");
  });

  it("returns first principles question for (1, 0)", () => {
    const q = getQuestion(1, 0);
    expect(q).toBeTruthy();
    expect(q).toContain("원칙");
  });

  it("returns style question for (3, 0)", () => {
    const q = getQuestion(3, 0);
    expect(q).toBeTruthy();
    expect(q).toContain("설명");
  });

  it("returns null for out-of-bounds phase", () => {
    expect(getQuestion(4, 0)).toBeNull();
    expect(getQuestion(10, 0)).toBeNull();
  });

  it("returns null for out-of-bounds question", () => {
    expect(getQuestion(0, 5)).toBeNull();
    expect(getQuestion(3, 1)).toBeNull();
  });
});

describe("getNextPosition", () => {
  it("advances within same phase", () => {
    const next = getNextPosition(0, 0);
    expect(next).toEqual({ phaseIndex: 0, questionIndex: 1 });
  });

  it("advances to next phase when current phase exhausted", () => {
    // domain has 2 questions: (0, 1) → (1, 0)
    const next = getNextPosition(0, 1);
    expect(next).toEqual({ phaseIndex: 1, questionIndex: 0 });
  });

  it("advances through principles phase", () => {
    expect(getNextPosition(1, 0)).toEqual({ phaseIndex: 1, questionIndex: 1 });
    expect(getNextPosition(1, 1)).toEqual({ phaseIndex: 1, questionIndex: 2 });
    expect(getNextPosition(1, 2)).toEqual({ phaseIndex: 2, questionIndex: 0 });
  });

  it("advances through scenarios phase", () => {
    expect(getNextPosition(2, 0)).toEqual({ phaseIndex: 2, questionIndex: 1 });
    expect(getNextPosition(2, 1)).toEqual({ phaseIndex: 2, questionIndex: 2 });
    expect(getNextPosition(2, 2)).toEqual({ phaseIndex: 3, questionIndex: 0 });
  });

  it("returns null when all questions completed", () => {
    // style phase has 1 question: (3, 0) is last
    const next = getNextPosition(3, 0);
    expect(next).toBeNull();
  });

  it("returns null for out-of-bounds", () => {
    expect(getNextPosition(4, 0)).toBeNull();
  });

  it("follows full interview flow correctly", () => {
    let pos: { phaseIndex: number; questionIndex: number } | null = {
      phaseIndex: 0,
      questionIndex: 0,
    };
    let count = 0;

    while (pos !== null) {
      count++;
      pos = getNextPosition(pos.phaseIndex, pos.questionIndex);
    }

    // Total 9 questions → 8 advances + 1 null at end = 9 total iterations
    expect(count).toBe(9);
  });
});
