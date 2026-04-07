import { describe, expect, it } from "vitest";
import type {
  Persona,
  StoreListing,
  TrialSession,
  Purchase,
  InviteCode,
  InterviewSession,
  ChatMessage,
  FileUpload,
  ApiKey,
} from "@/types";

describe("Type structures", () => {
  describe("Persona", () => {
    it("supports full persona with all fields", () => {
      const persona: Persona = {
        id: "p-1",
        user_id: "u-1",
        name: "테스트",
        domain: "기술",
        description: "설명",
        style: "친근",
        principles: ["원칙1", "원칙2"],
        decision_scenarios: [
          { situation: "상황", decision: "판단", reasoning: "근거" },
        ],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      expect(persona.principles).toHaveLength(2);
      expect(persona.decision_scenarios[0].reasoning).toBe("근거");
    });

    it("supports persona with nullable fields", () => {
      const persona: Persona = {
        id: "p-1",
        user_id: "u-1",
        name: "최소",
        domain: null,
        description: null,
        style: null,
        principles: [],
        decision_scenarios: [],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      expect(persona.domain).toBeNull();
    });
  });

  describe("StoreListing", () => {
    it("supports all status values", () => {
      const statuses: StoreListing["status"][] = [
        "draft",
        "pending_review",
        "active",
        "suspended",
        "archived",
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  describe("Purchase", () => {
    it("supports all status values", () => {
      const statuses: Purchase["status"][] = [
        "pending",
        "confirmed",
        "failed",
        "refunded",
        "cancelled",
      ];
      expect(statuses).toHaveLength(5);
    });

    it("revenue split adds up to total", () => {
      const purchase: Purchase = {
        id: "pu-1",
        buyer_id: "b-1",
        listing_id: "l-1",
        persona_id: "p-1",
        seller_id: "s-1",
        amount_krw: 10000,
        payment_method: "카드",
        toss_payment_key: "pk-1",
        toss_order_id: "order-1",
        status: "confirmed",
        seller_amount: 8000,
        platform_amount: 2000,
        settled: false,
        settled_at: null,
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(purchase.seller_amount! + purchase.platform_amount!).toBe(
        purchase.amount_krw
      );
    });
  });

  describe("TrialSession", () => {
    it("supports anonymous user (null user_id)", () => {
      const session: TrialSession = {
        id: "ts-1",
        listing_id: "l-1",
        user_id: null,
        ip_address: "127.0.0.1",
        fingerprint: "fp-hash",
        messages_today: 1,
        personas_today: ["p-1"],
        trial_date: "2026-04-07",
        created_at: "2026-04-07T00:00:00Z",
      };
      expect(session.user_id).toBeNull();
      expect(session.personas_today).toContain("p-1");
    });
  });

  describe("FileUpload", () => {
    it("supports all status transitions", () => {
      const statuses: FileUpload["status"][] = [
        "uploaded",
        "transcribing",
        "embedding",
        "done",
        "error",
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  describe("ChatMessage", () => {
    it("supports user and assistant roles", () => {
      const userMsg: ChatMessage = {
        id: "m-1",
        session_id: "s-1",
        role: "user",
        content: "질문입니다",
        created_at: "2026-01-01T00:00:00Z",
      };
      const assistantMsg: ChatMessage = {
        id: "m-2",
        session_id: "s-1",
        role: "assistant",
        content: "답변입니다",
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(userMsg.role).toBe("user");
      expect(assistantMsg.role).toBe("assistant");
    });
  });
});
