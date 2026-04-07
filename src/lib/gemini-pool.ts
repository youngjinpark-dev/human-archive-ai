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

export const POOL_SIZE = clients.length;
