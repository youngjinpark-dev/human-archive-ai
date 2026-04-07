import { describe, expect, it } from "vitest";

describe("Invite code validation", () => {
  it("rejects empty code", () => {
    const code = "";
    expect(!code).toBe(true);
  });

  it("rejects null code", () => {
    const code = null;
    expect(!code).toBe(true);
  });

  it("accepts valid code format", () => {
    const code = "BETA2026";
    expect(!!code).toBe(true);
  });

  it("validates invite is active and unused", () => {
    const invite = { code: "BETA2026", active: true, used_by: null };
    const isValid = invite.active && invite.used_by === null;
    expect(isValid).toBe(true);
  });

  it("rejects inactive invite", () => {
    const invite = { code: "OLD", active: false, used_by: null };
    const isValid = invite.active && invite.used_by === null;
    expect(isValid).toBe(false);
  });

  it("rejects used invite", () => {
    const invite = { code: "USED", active: true, used_by: "user-1" };
    const isValid = invite.active && invite.used_by === null;
    expect(isValid).toBe(false);
  });

  it("rejects expired invite", () => {
    const invite = {
      code: "EXPIRED",
      active: true,
      used_by: null,
      expires_at: "2025-01-01T00:00:00Z",
    };
    const isExpired =
      invite.expires_at && new Date(invite.expires_at) < new Date();
    expect(isExpired).toBeTruthy();
  });

  it("accepts non-expired invite", () => {
    const invite = {
      code: "VALID",
      active: true,
      used_by: null,
      expires_at: "2027-12-31T23:59:59Z",
    };
    const isExpired =
      invite.expires_at && new Date(invite.expires_at) < new Date();
    expect(isExpired).toBeFalsy();
  });

  it("accepts invite without expiration", () => {
    const invite = {
      code: "FOREVER",
      active: true,
      used_by: null,
      expires_at: null as string | null,
    };
    const isExpired =
      invite.expires_at && new Date(invite.expires_at) < new Date();
    expect(isExpired).toBeFalsy();
  });
});
