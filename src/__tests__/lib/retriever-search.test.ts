import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
const mockEmbedText = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/embedding", () => ({
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
  }),
}));

const { searchChunks } = await import("@/lib/retriever");

describe("searchChunks", () => {
  beforeEach(() => {
    mockEmbedText.mockReset();
    mockRpc.mockReset();
  });

  it("returns matching chunks from pgvector search", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockEmbedText.mockResolvedValue(fakeEmbedding);

    const mockResults = [
      { id: "c-1", content: "chunk 1", metadata: {}, similarity: 0.95 },
      { id: "c-2", content: "chunk 2", metadata: {}, similarity: 0.85 },
    ];
    mockRpc.mockResolvedValue({ data: mockResults, error: null });

    const results = await searchChunks("persona-1", "query text", 5);
    expect(results).toHaveLength(2);
    expect(results[0].similarity).toBe(0.95);
  });

  it("passes correct parameters to RPC", async () => {
    mockEmbedText.mockResolvedValue([0.1]);
    mockRpc.mockResolvedValue({ data: [], error: null });

    await searchChunks("p-1", "my query", 3);

    expect(mockEmbedText).toHaveBeenCalledWith("my query");
    expect(mockRpc).toHaveBeenCalledWith("match_chunks", {
      query_embedding: [0.1],
      target_persona_id: "p-1",
      match_count: 3,
    });
  });

  it("returns empty array on error", async () => {
    mockEmbedText.mockResolvedValue([0.1]);
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const results = await searchChunks("p-1", "query");
    expect(results).toEqual([]);
  });

  it("defaults to topK=5", async () => {
    mockEmbedText.mockResolvedValue([0.1]);
    mockRpc.mockResolvedValue({ data: [], error: null });

    await searchChunks("p-1", "query");
    expect(mockRpc).toHaveBeenCalledWith("match_chunks", {
      query_embedding: [0.1],
      target_persona_id: "p-1",
      match_count: 5,
    });
  });

  it("returns empty array when data is null", async () => {
    mockEmbedText.mockResolvedValue([0.1]);
    mockRpc.mockResolvedValue({ data: null, error: null });

    const results = await searchChunks("p-1", "query");
    expect(results).toEqual([]);
  });
});
