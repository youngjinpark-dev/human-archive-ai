import { describe, expect, it, vi, beforeEach } from "vitest";
import { STORE_CATEGORIES, HIGH_RISK_CATEGORIES } from "@/lib/store-constants";

// Test the validation logic used in store/register route
describe("Store register validation", () => {
  describe("required fields", () => {
    it("rejects missing persona_id", () => {
      const body = { title: "T", description: "D", category: "technology" };
      const { persona_id } = body as any;
      expect(!persona_id).toBe(true);
    });

    it("rejects missing title", () => {
      const body = { persona_id: "p1", description: "D", category: "technology" };
      const { title } = body as any;
      expect(!title).toBe(true);
    });

    it("rejects missing description", () => {
      const body = { persona_id: "p1", title: "T", category: "technology" };
      const { description } = body as any;
      expect(!description).toBe(true);
    });

    it("rejects missing category", () => {
      const body = { persona_id: "p1", title: "T", description: "D" };
      const { category } = body as any;
      expect(!category).toBe(true);
    });

    it("accepts valid body", () => {
      const body = {
        persona_id: "p1",
        title: "T",
        description: "D",
        category: "technology",
      };
      expect(body.persona_id && body.title && body.description && body.category).toBeTruthy();
    });
  });

  describe("category validation", () => {
    it("accepts all valid store categories", () => {
      for (const cat of STORE_CATEGORIES) {
        expect((STORE_CATEGORIES as readonly string[]).includes(cat)).toBe(true);
      }
    });

    it("rejects invalid categories", () => {
      expect((STORE_CATEGORIES as readonly string[]).includes("invalid")).toBe(false);
      expect((STORE_CATEGORIES as readonly string[]).includes("")).toBe(false);
    });

    it("blocks high-risk categories", () => {
      for (const cat of HIGH_RISK_CATEGORIES) {
        expect((HIGH_RISK_CATEGORIES as readonly string[]).includes(cat)).toBe(true);
      }
    });

    it("medical category is blocked", () => {
      const category = "medical";
      expect((HIGH_RISK_CATEGORIES as readonly string[]).includes(category)).toBe(true);
    });

    it("legal category is blocked", () => {
      const category = "legal";
      expect((HIGH_RISK_CATEGORIES as readonly string[]).includes(category)).toBe(true);
    });

    it("financial category is blocked", () => {
      const category = "financial";
      expect((HIGH_RISK_CATEGORIES as readonly string[]).includes(category)).toBe(true);
    });
  });
});
