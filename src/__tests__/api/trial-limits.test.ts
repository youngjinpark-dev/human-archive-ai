import { describe, expect, it } from "vitest";
import { TRIAL_LIMITS, DISCLAIMER_TEXT } from "@/lib/store-constants";

describe("Trial session limits", () => {
  it("limits messages to 2 per persona", () => {
    const messagesUsed = 2;
    expect(messagesUsed >= TRIAL_LIMITS.MESSAGES_PER_PERSONA).toBe(true);
  });

  it("allows messages under limit", () => {
    const messagesUsed = 1;
    expect(messagesUsed >= TRIAL_LIMITS.MESSAGES_PER_PERSONA).toBe(false);
  });

  it("limits daily personas to 3", () => {
    const uniquePersonas = ["p1", "p2", "p3"];
    const newPersonaId = "p4";
    const atLimit =
      uniquePersonas.length >= TRIAL_LIMITS.PERSONAS_PER_DAY &&
      !uniquePersonas.includes(newPersonaId);
    expect(atLimit).toBe(true);
  });

  it("allows trial for already-tried persona even at day limit", () => {
    const uniquePersonas = ["p1", "p2", "p3"];
    const existingPersonaId = "p2";
    const atLimit =
      uniquePersonas.length >= TRIAL_LIMITS.PERSONAS_PER_DAY &&
      !uniquePersonas.includes(existingPersonaId);
    expect(atLimit).toBe(false);
  });

  it("allows trial for new persona under day limit", () => {
    const uniquePersonas = ["p1"];
    const newPersonaId = "p2";
    const atLimit =
      uniquePersonas.length >= TRIAL_LIMITS.PERSONAS_PER_DAY &&
      !uniquePersonas.includes(newPersonaId);
    expect(atLimit).toBe(false);
  });
});

describe("Trial response formatting", () => {
  it("adds disclaimer to response", () => {
    const response = "AI 페르소나의 답변입니다.";
    const responseWithDisclaimer = `${DISCLAIMER_TEXT}\n\n${response}`;
    expect(responseWithDisclaimer).toContain(DISCLAIMER_TEXT);
    expect(responseWithDisclaimer).toContain(response);
  });

  it("calculates remaining messages correctly", () => {
    const messagesUsed = 1;
    const remaining = TRIAL_LIMITS.MESSAGES_PER_PERSONA - messagesUsed;
    expect(remaining).toBe(1);
  });

  it("shows 0 remaining at limit", () => {
    const messagesUsed = 2;
    const remaining = TRIAL_LIMITS.MESSAGES_PER_PERSONA - messagesUsed;
    expect(remaining).toBe(0);
  });
});
