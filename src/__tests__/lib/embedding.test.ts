import { describe, expect, it, vi, beforeEach } from "vitest";

const mockEmbedContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        embedContent: mockEmbedContent,
      };
    },
  };
});

const { embedText, embedTexts, EMBEDDING_DIMENSIONS } = await import(
  "@/lib/embedding"
);

describe("EMBEDDING_DIMENSIONS", () => {
  it("is 768", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });
});

describe("embedText", () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
  });

  it("returns embedding values from API response", async () => {
    const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: fakeEmbedding }],
    });

    const result = await embedText("test text");
    expect(result).toEqual(fakeEmbedding);
    expect(result).toHaveLength(768);
  });

  it("passes correct model and config", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.1] }],
    });

    await embedText("hello");
    const callArgs = mockEmbedContent.mock.calls[0][0];
    expect(callArgs.model).toBe("gemini-embedding-001");
    expect(callArgs.contents).toBe("hello");
    expect(callArgs.config.outputDimensionality).toBe(768);
  });

  it("returns empty array when no embeddings", async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [] });
    const result = await embedText("test");
    expect(result).toEqual([]);
  });

  it("returns empty array when embeddings undefined", async () => {
    mockEmbedContent.mockResolvedValue({});
    const result = await embedText("test");
    expect(result).toEqual([]);
  });
});

describe("embedTexts", () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
  });

  it("returns empty array for empty input", async () => {
    const result = await embedTexts([]);
    expect(result).toEqual([]);
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it("embeds multiple texts sequentially", async () => {
    let callCount = 0;
    mockEmbedContent.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        embeddings: [{ values: [callCount] }],
      });
    });

    const result = await embedTexts(["text1", "text2", "text3"]);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([1]);
    expect(result[1]).toEqual([2]);
    expect(result[2]).toEqual([3]);
    expect(mockEmbedContent).toHaveBeenCalledTimes(3);
  });
});
