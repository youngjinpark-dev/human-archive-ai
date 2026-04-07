/**
 * 임베딩 모듈 — Gemini Embedding 001 (무료, 768차원으로 축소)
 *
 * 추후 전환 시: 이 파일만 교체 (OpenAI, Voyage 등)
 * 단, 차원이 변경되면 DB 스키마 + 기존 데이터 재임베딩 필요
 */

import { withRetry } from "@/lib/gemini-pool";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

export async function embedText(text: string): Promise<number[]> {
  return withRetry(async (client) => {
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    return response.embeddings?.[0]?.values ?? [];
  });
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await embedText(text);
    results.push(embedding);
  }
  return results;
}

export { EMBEDDING_DIMENSIONS };
