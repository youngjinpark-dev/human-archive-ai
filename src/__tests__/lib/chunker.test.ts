import { describe, expect, it } from "vitest";
import { chunkText, type TextChunk } from "@/lib/chunker";

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
    expect(chunkText("\n\n")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const result = chunkText("안녕하세요");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("안녕하세요");
    expect(result[0].metadata.chunk_index).toBe(0);
  });

  it("splits text by paragraph boundaries", () => {
    const text = "첫 번째 문단입니다.\n\n두 번째 문단입니다.\n\n세 번째 문단입니다.";
    const result = chunkText(text, {}, { maxChars: 50, overlap: 0 });
    // All paragraphs are short enough to fit in one chunk
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Verify text content is preserved
    const allText = result.map((c) => c.text).join(" ");
    expect(allText).toContain("첫 번째");
    expect(allText).toContain("세 번째");
  });

  it("creates multiple chunks for long text", () => {
    // Create text longer than maxChars
    const para1 = "가".repeat(500);
    const para2 = "나".repeat(500);
    const text = `${para1}\n\n${para2}`;
    const result = chunkText(text, {}, { maxChars: 600, overlap: 50 });
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves metadata with chunk_index", () => {
    const text = "A".repeat(400) + "\n\n" + "B".repeat(400) + "\n\n" + "C".repeat(400);
    const meta = { source: "test.mp3", type: "audio" };
    const result = chunkText(text, meta, { maxChars: 500, overlap: 50 });
    expect(result.length).toBeGreaterThanOrEqual(2);
    result.forEach((chunk, i) => {
      expect(chunk.metadata.source).toBe("test.mp3");
      expect(chunk.metadata.type).toBe("audio");
      expect(chunk.metadata.chunk_index).toBe(i);
    });
  });

  it("applies overlap between chunks", () => {
    const para1 = "가나다라마바사아자차카타파하" + "A".repeat(790);
    const para2 = "B".repeat(400);
    const text = `${para1}\n\n${para2}`;
    const result = chunkText(text, {}, { maxChars: 800, overlap: 100 });
    if (result.length >= 2) {
      // Second chunk should contain overlap from end of first chunk
      const firstEnd = result[0].text.slice(-100);
      expect(result[1].text).toContain(firstEnd);
    }
  });

  it("uses default options (maxChars=800, overlap=100)", () => {
    // Verify defaults by creating text just under default max
    const text = "A".repeat(700);
    const result = chunkText(text);
    expect(result).toHaveLength(1);
  });

  it("handles single paragraph longer than maxChars", () => {
    const text = "가".repeat(1000); // No paragraph breaks
    const result = chunkText(text, {}, { maxChars: 500, overlap: 50 });
    // No paragraph breaks means it goes into one chunk
    expect(result).toHaveLength(1);
    expect(result[0].text.length).toBe(1000);
  });

  it("handles text with various whitespace patterns", () => {
    const text = "첫번째\n\n\n\n두번째\n\n   \n\n세번째";
    const result = chunkText(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const allText = result.map((c) => c.text).join(" ");
    expect(allText).toContain("첫번째");
    expect(allText).toContain("세번째");
  });
});
