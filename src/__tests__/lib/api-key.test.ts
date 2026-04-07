import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

describe("generateApiKey", () => {
  it("returns raw key starting with ha_", () => {
    const { raw } = generateApiKey();
    expect(raw).toMatch(/^ha_/);
  });

  it("returns a hex hash (64 chars SHA-256)", () => {
    const { hash } = generateApiKey();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns prefix as first 10 chars of raw", () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix).toBe(raw.slice(0, 10));
    expect(prefix).toMatch(/^ha_/);
  });

  it("generates unique keys each time", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.raw).not.toBe(key2.raw);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it("hash matches hashApiKey output", () => {
    const { raw, hash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
  });
});

describe("hashApiKey", () => {
  it("produces consistent hash for same input", () => {
    const input = "ha_test123";
    const hash1 = hashApiKey(input);
    const hash2 = hashApiKey(input);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashApiKey("ha_key1")).not.toBe(hashApiKey("ha_key2"));
  });

  it("returns 64 char hex string", () => {
    const hash = hashApiKey("ha_anything");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
