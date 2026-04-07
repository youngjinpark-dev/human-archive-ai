/**
 * Gemini API 키 풀 — 여러 프로젝트의 키를 라운드로빈으로 사용하여 쿼터 분산
 *
 * 환경변수: GEMINI_API_KEY (쉼표 구분)
 * 예: GEMINI_API_KEY=key1,key2,key3
 */

import { GoogleGenAI } from "@google/genai";

const keys = (process.env.GEMINI_API_KEY ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const clients = keys.length > 0
  ? keys.map((key) => new GoogleGenAI({ apiKey: key }))
  : [];

let currentIndex = 0;

/**
 * 다음 GoogleGenAI 인스턴스를 라운드로빈으로 반환한다.
 */
export function getGeminiClient(): GoogleGenAI {
  if (clients.length === 0) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  const client = clients[currentIndex];
  currentIndex = (currentIndex + 1) % clients.length;
  return client;
}

const RETRYABLE_CODES = new Set([429, 500, 503]);

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    // Gemini SDK wraps HTTP status in error message
    if (RETRYABLE_CODES.has(Number((msg.match(/\b(\d{3})\b/)?.[1])))) return true;
    if (/UNAVAILABLE|RESOURCE_EXHAUSTED|too many requests|overloaded/i.test(msg)) return true;
  }
  return false;
}

/**
 * 모든 키를 순회하며 fn을 시도한다.
 * 재시도 가능한 에러(429/500/503)면 다음 키로 넘어가고,
 * 그 외 에러는 즉시 throw한다.
 */
export async function withRetry<T>(fn: (client: GoogleGenAI) => Promise<T>): Promise<T> {
  if (clients.length === 0) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  let lastError: unknown;
  for (let i = 0; i < clients.length; i++) {
    const client = getGeminiClient();
    try {
      return await fn(client);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      // retryable → 다음 키로 계속
    }
  }
  throw lastError;
}

export const POOL_SIZE = clients.length;
