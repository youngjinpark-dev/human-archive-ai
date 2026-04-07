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

  // 문단 단위로 분리 (빈 줄, 단일 줄바꿈, 또는 문장 끝 마침표+공백)
  const segments = text
    .split(/\n\s*\n/)
    .flatMap((p) => p.split(/\n/))
    .map((s) => s.trim())
    .filter(Boolean);

  // 분리된 세그먼트가 여전히 maxChars 초과하면 문장 단위로 강제 분할
  const paragraphs: string[] = [];
  for (const seg of segments) {
    if (seg.length <= maxChars) {
      paragraphs.push(seg);
    } else {
      // 문장 부호(. ? ! 。) 기준으로 분할
      const sentences = seg.match(/[^.?!。]+[.?!。]?\s*/g) ?? [seg];
      let buf = "";
      for (const sentence of sentences) {
        if (buf.length + sentence.length > maxChars && buf.length > 0) {
          paragraphs.push(buf.trim());
          buf = sentence;
        } else {
          buf += sentence;
        }
      }
      if (buf.trim()) paragraphs.push(buf.trim());
    }
  }

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
      current = overlapText + " " + para;
    } else {
      current = current ? current + " " + para : para;
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
