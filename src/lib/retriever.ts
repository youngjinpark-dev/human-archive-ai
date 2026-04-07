import { createServiceClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/embedding";

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * pgvector를 사용하여 유사 청크를 검색한다.
 * (기존 Python retriever.py의 포트 — ChromaDB → pgvector)
 */
export async function searchChunks(
  personaId: string,
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const queryEmbedding = await embedText(query);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    target_persona_id: personaId,
    match_count: topK,
  });

  if (error) {
    console.error("Vector search error:", error);
    return [];
  }

  return (data ?? []) as SearchResult[];
}

export function formatContext(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return "(관련 자료 없음)";
  }

  return results
    .map((r, i) => {
      const source = r.metadata?.source ?? "참고자료";
      return `[${i + 1}] (${source})\n${r.content}`;
    })
    .join("\n\n");
}
