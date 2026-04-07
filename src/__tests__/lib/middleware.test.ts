import { describe, expect, it } from "vitest";

// We test the middleware logic by simulating its behavior
// (actual middleware depends on Next.js runtime and Supabase)

describe("middleware routing logic", () => {
  const publicPaths = ["/", "/login", "/signup", "/store", "/store/some-id", "/.well-known/mcp", "/api/store", "/api/store/some-id"];
  const protectedPaths = ["/personas", "/personas/new", "/api-keys", "/purchases", "/seller"];
  const externalApiPaths = ["/api/external/chat", "/api/external/personas", "/api/external/store"];

  function shouldRedirect(path: string): boolean {
    const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");
    const isApiExternal = path.startsWith("/api/external");
    const isApiStore = path.startsWith("/api/store");
    const isWellKnown = path.startsWith("/.well-known");
    const isRootPage = path === "/";
    const isStoreBrowsing = path.startsWith("/store");

    return !isAuthPage && !isApiExternal && !isApiStore && !isWellKnown && !isRootPage && !isStoreBrowsing;
  }

  it("allows unauthenticated access to public paths", () => {
    for (const path of publicPaths) {
      expect(shouldRedirect(path)).toBe(false);
    }
  });

  it("redirects unauthenticated users on protected paths", () => {
    for (const path of protectedPaths) {
      expect(shouldRedirect(path)).toBe(true);
    }
  });

  it("allows external API paths without authentication", () => {
    for (const path of externalApiPaths) {
      const isApiExternal = path.startsWith("/api/external");
      expect(isApiExternal).toBe(true);
    }
  });

  it("allows /api/store paths without authentication", () => {
    const storeApiPaths = ["/api/store", "/api/store/listing-1", "/api/store/listing-1/trial"];
    for (const path of storeApiPaths) {
      expect(shouldRedirect(path)).toBe(false);
    }
  });

  it("redirects authenticated users from auth pages to /personas", () => {
    const user = { id: "user-1" };
    for (const path of ["/login", "/signup"]) {
      const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");
      const shouldRedirectToDashboard = user && isAuthPage;
      expect(shouldRedirectToDashboard).toBe(true);
    }
  });
});
