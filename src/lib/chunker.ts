export interface TextChunk {
  text: string;
  metadata: Record<string, unknown>;
}

/**
 * 텍스트를 청킹한다.
 * (기존 Python chunker.py의 포트 — YouTube 자막 대신 범용 텍스트 대응)
 */
export function chunkText(
  text: string,
  metadata: Record<string, unknown> = {},
  options?: { maxChars?: number; overlap?: number }
): TextChunk[] {
  const maxChars = options?.maxChars ?? 800;
  const overlap = options?.overlap ?? 100;

  if (!text.trim()) return [];

  // 문단 단위로 분리
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 1 > maxChars && current.length > 0) {
      chunks.push({
        text: current.trim(),
        metadata: { ...metadata, chunk_index: chunks.length },
      });
      // overlap: 이전 청크 끝부분 유지
      const overlapText = current.slice(-overlap);
      current = overlapText + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  // 남은 텍스트
  if (current.trim()) {
    chunks.push({
      text: current.trim(),
      metadata: { ...metadata, chunk_index: chunks.length },
    });
  }

  return chunks;
}
