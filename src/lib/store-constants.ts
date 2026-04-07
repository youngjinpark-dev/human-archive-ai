export const STORE_CATEGORIES = [
  "technology", "business", "education", "lifestyle", "creative", "career", "other",
] as const;

export const HIGH_RISK_CATEGORIES = ["medical", "legal", "financial"] as const;

export const TRIAL_LIMITS = {
  MESSAGES_PER_PERSONA: 2,
  PERSONAS_PER_DAY: 3,
} as const;

export const DISCLAIMER_TEXT = "본 응답은 AI 페르소나가 생성한 것이며, 실제 전문가의 조언을 대체하지 않습니다.";

export type StoreCategory = typeof STORE_CATEGORIES[number];
