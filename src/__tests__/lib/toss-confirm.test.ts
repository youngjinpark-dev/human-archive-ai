import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Must set env before importing
vi.stubEnv("TOSS_SECRET_KEY", "test_sk_1234567890");

const { confirmPayment } = await import("@/lib/toss");

describe("confirmPayment", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends correct request to Toss API", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ status: "DONE" }),
    });

    await confirmPayment("pk_test_123", "order_123", 10000);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/confirm");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("sends Basic auth header with base64-encoded secret key", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ status: "DONE" }),
    });

    await confirmPayment("pk", "order", 100);

    const [, options] = mockFetch.mock.calls[0];
    const authHeader = options.headers.Authorization;
    expect(authHeader).toMatch(/^Basic /);

    // Decode and verify it's the secret key with colon
    const decoded = Buffer.from(authHeader.replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("test_sk_1234567890:");
  });

  it("sends paymentKey, orderId, amount in body", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ status: "DONE" }),
    });

    await confirmPayment("pk_abc", "order_xyz", 50000);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      paymentKey: "pk_abc",
      orderId: "order_xyz",
      amount: 50000,
    });
  });

  it("returns parsed JSON response", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: "DONE",
          method: "카드",
          totalAmount: 10000,
        }),
    });

    const result = await confirmPayment("pk", "order", 10000);
    expect(result.status).toBe("DONE");
    expect(result.method).toBe("카드");
  });

  it("returns error response on failure", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: "FAILED",
          message: "잔액 부족",
        }),
    });

    const result = await confirmPayment("pk", "order", 10000);
    expect(result.status).toBe("FAILED");
    expect(result.message).toBe("잔액 부족");
  });
});
