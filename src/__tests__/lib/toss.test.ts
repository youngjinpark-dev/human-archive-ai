import { describe, expect, it } from "vitest";
import { generateOrderId } from "@/lib/toss";

describe("generateOrderId", () => {
  it("starts with order_", () => {
    const id = generateOrderId();
    expect(id.startsWith("order_")).toBe(true);
  });

  it("matches expected format: order_{timestamp}_{random}", () => {
    const id = generateOrderId();
    expect(id).toMatch(/^order_\d+_[a-z0-9]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOrderId()));
    expect(ids.size).toBe(100);
  });

  it("contains a reasonable timestamp", () => {
    const id = generateOrderId();
    const timestamp = parseInt(id.split("_")[1], 10);
    const now = Date.now();
    // Timestamp should be within 1 second of now
    expect(Math.abs(now - timestamp)).toBeLessThan(1000);
  });
});
