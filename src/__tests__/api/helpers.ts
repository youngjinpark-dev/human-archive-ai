import { vi } from "vitest";

/**
 * Supabase query builder mock that supports chaining.
 */
export function createMockQueryBuilder(data: unknown = null, error: unknown = null) {
  const builder: Record<string, any> = {};
  const methods = [
    "select", "insert", "update", "delete", "upsert",
    "eq", "neq", "gt", "gte", "lt", "lte",
    "like", "ilike", "is", "in",
    "order", "limit", "range",
    "single", "maybeSingle",
  ];

  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods return data
  builder.single = vi.fn().mockResolvedValue({ data, error });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data, error });

  // Make select/insert/update/delete return the builder but also allow awaiting
  const makeAwaitable = (method: string) => {
    builder[method] = vi.fn().mockReturnValue({
      ...builder,
      then: (resolve: (val: any) => void) =>
        resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error }),
    });
  };

  // Override select to be awaitable when no chaining follows
  const origSelect = builder.select;
  builder.select = vi.fn((...args: any[]) => {
    const result = { ...builder };
    // If awaited directly (no further chaining), resolve with data
    result.then = (resolve: (val: any) => void) =>
      resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error });
    return result;
  });

  return builder;
}

export function createMockSupabase(overrides: Record<string, any> = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.user ?? { id: "user-1" } },
      }),
    },
    from: vi.fn().mockReturnValue(createMockQueryBuilder(overrides.data, overrides.error)),
    rpc: vi.fn().mockResolvedValue({ data: overrides.rpcData ?? null, error: overrides.rpcError ?? null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      }),
    },
    ...overrides,
  };
}
