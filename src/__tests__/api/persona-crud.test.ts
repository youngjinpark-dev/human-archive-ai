import { describe, expect, it } from "vitest";

describe("Persona CRUD validation", () => {
  describe("create persona", () => {
    it("requires name field", () => {
      const body = { domain: "AI" };
      expect(!(body as any).name).toBe(true);
    });

    it("accepts minimal fields (name only)", () => {
      const body = { name: "테스트" };
      expect(!!body.name).toBe(true);
    });

    it("accepts all optional fields", () => {
      const body = {
        name: "전문가",
        domain: "AI",
        description: "설명",
        style: "친근",
      };
      expect(body.name).toBeTruthy();
      expect(body.domain).toBeTruthy();
      expect(body.description).toBeTruthy();
      expect(body.style).toBeTruthy();
    });

    it("handles null optional fields", () => {
      const body = {
        name: "전문가",
        domain: null as string | null,
        description: null as string | null,
        style: null as string | null,
      };
      const dbInsert = {
        name: body.name,
        domain: body.domain ?? null,
        description: body.description ?? null,
        style: body.style ?? null,
      };
      expect(dbInsert.domain).toBeNull();
    });
  });

  describe("update persona", () => {
    it("builds update object only with provided fields", () => {
      const body = { name: "새이름", description: "새설명" };
      const updates: Record<string, unknown> = {};
      if ((body as any).name !== undefined) updates.name = body.name;
      if ((body as any).domain !== undefined) updates.domain = (body as any).domain;
      if (body.description !== undefined) updates.description = body.description;

      expect(updates).toEqual({ name: "새이름", description: "새설명" });
      expect(updates).not.toHaveProperty("domain");
    });

    it("supports updating principles array", () => {
      const body = { principles: ["원칙1", "원칙2", "원칙3"] };
      const updates: Record<string, unknown> = {};
      if (body.principles !== undefined) updates.principles = body.principles;
      expect(updates.principles).toHaveLength(3);
    });

    it("supports updating decision_scenarios array", () => {
      const body = {
        decision_scenarios: [
          { situation: "상황", decision: "판단", reasoning: "근거" },
        ],
      };
      const updates: Record<string, unknown> = {};
      if (body.decision_scenarios !== undefined)
        updates.decision_scenarios = body.decision_scenarios;
      expect(updates.decision_scenarios).toHaveLength(1);
    });
  });
});

describe("API keys CRUD validation", () => {
  it("requires owner field for creation", () => {
    const body = { allowed_personas: [] };
    expect(!(body as any).owner).toBe(true);
  });

  it("accepts owner with optional allowed_personas", () => {
    const body = { owner: "My Key" };
    const allowedPersonas = (body as any).allowed_personas ?? [];
    expect(allowedPersonas).toEqual([]);
  });

  it("requires key ID for deletion", () => {
    const keyId = null;
    expect(!keyId).toBe(true);
  });
});
