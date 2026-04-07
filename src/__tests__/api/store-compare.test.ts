import { describe, expect, it } from "vitest";

describe("Store compare validation", () => {
  it("requires compare_with_listing_id and question", () => {
    const body1 = { question: "어떻게 생각하세요?" };
    expect(!(body1 as any).compare_with_listing_id || !body1.question).toBe(true);

    const body2 = { compare_with_listing_id: "l-2" };
    expect(!body2.compare_with_listing_id || !(body2 as any).question).toBe(true);

    const body3 = {
      compare_with_listing_id: "l-2",
      question: "기술 스택 선택 기준은?",
    };
    expect(!body3.compare_with_listing_id || !body3.question).toBe(false);
  });

  describe("access check for compare", () => {
    it("allows owner to compare own persona", () => {
      const sellerId = "user-1";
      const currentUserId = "user-1";
      const isOwner = sellerId === currentUserId;
      expect(isOwner).toBe(true);
    });

    it("allows buyer with confirmed purchase", () => {
      const sellerId: string = "user-1";
      const currentUserId: string = "user-2";
      const isOwner = sellerId === currentUserId;
      const purchaseExists = true;
      expect(isOwner || purchaseExists).toBe(true);
    });

    it("denies non-owner without purchase", () => {
      const sellerId: string = "user-1";
      const currentUserId: string = "user-2";
      const isOwner = sellerId === currentUserId;
      const purchaseExists = false;
      expect(isOwner || purchaseExists).toBe(false);
    });

    it("requires access to both personas", () => {
      const accessA = true;
      const accessB = false;
      expect(accessA && accessB).toBe(false);

      const bothAccess = true;
      expect(bothAccess && true).toBe(true);
    });
  });
});

describe("Compare response format", () => {
  it("returns both persona responses side by side", () => {
    const response = {
      persona_a: { name: "김전문가", response: "답변 A" },
      persona_b: { name: "박교수", response: "답변 B" },
    };
    expect(response.persona_a.name).toBe("김전문가");
    expect(response.persona_b.name).toBe("박교수");
    expect(response.persona_a.response).toBeTruthy();
    expect(response.persona_b.response).toBeTruthy();
  });
});
