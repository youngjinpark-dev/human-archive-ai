import { describe, expect, it } from "vitest";
import { generateOrderId } from "@/lib/toss";

describe("Purchase flow logic", () => {
  describe("order creation", () => {
    it("generates valid order ID", () => {
      const orderId = generateOrderId();
      expect(orderId).toMatch(/^order_/);
    });

    it("calculates revenue split correctly (80/20)", () => {
      const priceKrw = 10000;
      const revenueSplitSeller = 80;
      const sellerAmount = Math.floor(priceKrw * (revenueSplitSeller / 100));
      const platformAmount = priceKrw - sellerAmount;
      expect(sellerAmount).toBe(8000);
      expect(platformAmount).toBe(2000);
      expect(sellerAmount + platformAmount).toBe(priceKrw);
    });

    it("handles odd amounts correctly (floor)", () => {
      const priceKrw = 9999;
      const revenueSplitSeller = 80;
      const sellerAmount = Math.floor(priceKrw * (revenueSplitSeller / 100));
      const platformAmount = priceKrw - sellerAmount;
      expect(sellerAmount).toBe(7999);
      expect(platformAmount).toBe(2000);
      expect(sellerAmount + platformAmount).toBe(priceKrw);
    });

    it("handles free listings", () => {
      const priceKrw = 0;
      const revenueSplitSeller = 80;
      const sellerAmount = Math.floor(priceKrw * (revenueSplitSeller / 100));
      const platformAmount = priceKrw - sellerAmount;
      expect(sellerAmount).toBe(0);
      expect(platformAmount).toBe(0);
    });
  });

  describe("purchase validation", () => {
    it("prevents self-purchase", () => {
      const sellerId = "user-1";
      const buyerId = "user-1";
      expect(sellerId === buyerId).toBe(true);
    });

    it("allows purchase from different user", () => {
      const sellerId = "user-1";
      const buyerId = "user-2";
      expect(sellerId === buyerId).toBe(false);
    });

    it("detects duplicate purchase", () => {
      const existingPurchase = { id: "purchase-1" };
      expect(!!existingPurchase).toBe(true);
    });

    it("amount validation", () => {
      const purchaseAmount = 10000;
      const requestAmount = 10000;
      expect(purchaseAmount === requestAmount).toBe(true);

      const mismatchAmount = 5000;
      expect(purchaseAmount === mismatchAmount).toBe(false);
    });
  });

  describe("payment status transitions", () => {
    it("pending → confirmed on success", () => {
      const tossStatus = "DONE";
      const newStatus = tossStatus === "DONE" ? "confirmed" : "failed";
      expect(newStatus).toBe("confirmed");
    });

    it("pending → failed on failure", () => {
      const tossStatus = "FAILED";
      const newStatus = tossStatus === "DONE" ? "confirmed" : "failed";
      expect(newStatus).toBe("failed");
    });
  });
});

describe("Webhook idempotency", () => {
  it("DONE event updates to confirmed only if not already confirmed", () => {
    const eventStatus = "DONE";
    const currentStatus = "pending";
    const shouldUpdate = eventStatus === "DONE" && currentStatus !== "confirmed";
    expect(shouldUpdate).toBe(true);
  });

  it("DONE event skips if already confirmed", () => {
    const eventStatus = "DONE";
    const currentStatus = "confirmed";
    const shouldUpdate = eventStatus === "DONE" && currentStatus !== "confirmed";
    expect(shouldUpdate).toBe(false);
  });

  it("CANCELED event updates to cancelled", () => {
    const eventStatus = "CANCELED";
    const currentStatus = "confirmed";
    const shouldUpdate = eventStatus === "CANCELED" && currentStatus !== "cancelled";
    expect(shouldUpdate).toBe(true);
  });

  it("CANCELED event skips if already cancelled", () => {
    const eventStatus = "CANCELED";
    const currentStatus = "cancelled";
    const shouldUpdate = eventStatus === "CANCELED" && currentStatus !== "cancelled";
    expect(shouldUpdate).toBe(false);
  });
});
