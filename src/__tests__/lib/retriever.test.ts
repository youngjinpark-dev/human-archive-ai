import { describe, expect, it } from "vitest";
import { formatContext, type SearchResult } from "@/lib/retriever";

describe("formatContext", () => {
  it("returns empty message for empty results", () => {
    expect(formatContext([])).toBe("(관련 자료 없음)");
  });

  it("returns empty message for null-like input", () => {
    // @ts-expect-error testing null input
    expect(formatContext(null)).toBe("(관련 자료 없음)");
    // @ts-expect-error testing undefined input
    expect(formatContext(undefined)).toBe("(관련 자료 없음)");
  });

  it("formats single result with source", () => {
    const results: SearchResult[] = [
      {
        id: "1",
        content: "테스트 내용입니다",
        metadata: { source: "lecture.mp3" },
        similarity: 0.9,
      },
    ];
    const context = formatContext(results);
    expect(context).toBe("[1] (lecture.mp3)\n테스트 내용입니다");
  });

  it("formats multiple results with numbering", () => {
    const results: SearchResult[] = [
      {
        id: "1",
        content: "첫 번째 내용",
        metadata: { source: "file1.mp3" },
        similarity: 0.9,
      },
      {
        id: "2",
        content: "두 번째 내용",
        metadata: { source: "file2.mp3" },
        similarity: 0.8,
      },
      {
        id: "3",
        content: "세 번째 내용",
        metadata: { source: "file3.mp3" },
        similarity: 0.7,
      },
    ];
    const context = formatContext(results);
    expect(context).toContain("[1] (file1.mp3)\n첫 번째 내용");
    expect(context).toContain("[2] (file2.mp3)\n두 번째 내용");
    expect(context).toContain("[3] (file3.mp3)\n세 번째 내용");
  });

  it("uses default source label when metadata.source is missing", () => {
    const results: SearchResult[] = [
      {
        id: "1",
        content: "내용",
        metadata: {},
        similarity: 0.9,
      },
    ];
    const context = formatContext(results);
    expect(context).toBe("[1] (참고자료)\n내용");
  });

  it("separates results with double newlines", () => {
    const results: SearchResult[] = [
      { id: "1", content: "A", metadata: {}, similarity: 0.9 },
      { id: "2", content: "B", metadata: {}, similarity: 0.8 },
    ];
    const context = formatContext(results);
    expect(context).toContain("\n\n");
    const parts = context.split("\n\n");
    expect(parts).toHaveLength(2);
  });
});
