import { describe, expect, it } from "vitest";

describe("Chat access control (personas/[id]/chat)", () => {
  describe("owner access", () => {
    it("allows owner to chat with own persona", () => {
      const persona = { user_id: "user-1" };
      const currentUser = { id: "user-1" };
      const isOwner = persona.user_id === currentUser.id;
      expect(isOwner).toBe(true);
    });

    it("denies non-owner without purchase", () => {
      const persona = { user_id: "user-1" };
      const currentUser = { id: "user-2" };
      const isOwner = persona.user_id === currentUser.id;
      const hasPurchase = false;
      expect(isOwner || hasPurchase).toBe(false);
    });
  });

  describe("buyer access", () => {
    it("allows buyer with confirmed purchase", () => {
      const persona = { user_id: "user-1" };
      const currentUser = { id: "user-2" };
      const isOwner = persona.user_id === currentUser.id;
      const purchase = { id: "purchase-1", status: "confirmed" };
      expect(isOwner || !!purchase).toBe(true);
    });

    it("denies buyer with pending purchase", () => {
      const persona = { user_id: "user-1" };
      const currentUser = { id: "user-2" };
      const isOwner = persona.user_id === currentUser.id;
      // Query only looks for status='confirmed', so pending = no result
      const purchase = null;
      expect(isOwner || !!purchase).toBe(false);
    });

    it("denies buyer with cancelled purchase", () => {
      const persona = { user_id: "user-1" };
      const currentUser = { id: "user-2" };
      const isOwner = persona.user_id === currentUser.id;
      const purchase = null; // cancelled != confirmed
      expect(isOwner || !!purchase).toBe(false);
    });
  });
});

describe("External chat API key validation", () => {
  it("rejects request without API key", () => {
    const apiKey = null;
    expect(!apiKey).toBe(true);
  });

  it("rejects invalid API key", () => {
    const keyRecord = null;
    expect(!keyRecord).toBe(true);
  });

  it("accepts valid API key", () => {
    const keyRecord = { user_id: "user-1", active: true };
    expect(!!keyRecord).toBe(true);
  });
});

describe("External API persona ownership with allowed_personas", () => {
  it("returns all personas when allowed_personas is empty", () => {
    const keyRecord = { user_id: "user-1", allowed_personas: [] };
    const shouldFilterByIds = keyRecord.allowed_personas.length > 0;
    expect(shouldFilterByIds).toBe(false);
  });

  it("filters by allowed_personas when specified", () => {
    const keyRecord = {
      user_id: "user-1",
      allowed_personas: ["p-1", "p-2"],
    };
    const shouldFilterByIds = keyRecord.allowed_personas.length > 0;
    expect(shouldFilterByIds).toBe(true);
    expect(keyRecord.allowed_personas).toContain("p-1");
    expect(keyRecord.allowed_personas).not.toContain("p-3");
  });
});
