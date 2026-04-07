import { describe, expect, it } from "vitest";
import {
  STORE_CATEGORIES,
  HIGH_RISK_CATEGORIES,
  TRIAL_LIMITS,
  DISCLAIMER_TEXT,
} from "@/lib/store-constants";

describe("STORE_CATEGORIES", () => {
  it("contains all expected categories", () => {
    const expected = [
      "technology",
      "business",
      "education",
      "lifestyle",
      "creative",
      "career",
      "other",
    ];
    expect([...STORE_CATEGORIES]).toEqual(expected);
  });

  it("has exactly 7 categories", () => {
    expect(STORE_CATEGORIES.length).toBe(7);
  });
});

describe("HIGH_RISK_CATEGORIES", () => {
  it("contains medical, legal, financial", () => {
    expect(HIGH_RISK_CATEGORIES).toContain("medical");
    expect(HIGH_RISK_CATEGORIES).toContain("legal");
    expect(HIGH_RISK_CATEGORIES).toContain("financial");
  });

  it("does not overlap with STORE_CATEGORIES", () => {
    for (const cat of HIGH_RISK_CATEGORIES) {
      expect((STORE_CATEGORIES as readonly string[]).includes(cat)).toBe(false);
    }
  });
});

describe("TRIAL_LIMITS", () => {
  it("allows 2 messages per persona", () => {
    expect(TRIAL_LIMITS.MESSAGES_PER_PERSONA).toBe(2);
  });

  it("allows 3 personas per day", () => {
    expect(TRIAL_LIMITS.PERSONAS_PER_DAY).toBe(3);
  });
});

describe("DISCLAIMER_TEXT", () => {
  it("is a non-empty Korean string", () => {
    expect(DISCLAIMER_TEXT).toBeTruthy();
    expect(typeof DISCLAIMER_TEXT).toBe("string");
    expect(DISCLAIMER_TEXT).toContain("AI 페르소나");
  });
});
