import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Supabase service client
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const { loadFramework } = await import("@/lib/framework-loader");

describe("loadFramework", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockSingle.mockReset();
    mockOrder.mockReset();
  });

  it("returns null when no framework found", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
        }),
      }),
    });

    const result = await loadFramework("p-nonexistent");
    expect(result).toBeNull();
  });

  it("returns framework data with axes and patterns", async () => {
    const mockFramework = {
      id: "f-1",
      persona_id: "p-1",
      philosophy: "사용자 가치",
      domains: ["백엔드"],
      version: 1,
      status: "ready",
    };
    const mockAxes = [
      { id: "a-1", name: "확장성", weight: 0.9 },
    ];
    const mockPatterns = [
      { id: "pt-1", condition: "조건", action: "행동", confidence: 0.8 },
    ];

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "judgment_frameworks") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockFramework }),
            }),
          }),
        };
      }
      if (table === "judgment_axes") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockAxes }),
            }),
          }),
        };
      }
      if (table === "if_then_patterns") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockPatterns }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await loadFramework("p-1");
    expect(result).not.toBeNull();
    expect(result!.framework).toEqual(mockFramework);
    expect(result!.axes).toEqual(mockAxes);
    expect(result!.patterns).toEqual(mockPatterns);
  });

  it("returns empty arrays when axes/patterns are null", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "judgment_frameworks") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "f-1", persona_id: "p-1" },
                }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null }),
          }),
        }),
      };
    });

    const result = await loadFramework("p-1");
    expect(result).not.toBeNull();
    expect(result!.axes).toEqual([]);
    expect(result!.patterns).toEqual([]);
  });
});
