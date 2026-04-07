import { describe, expect, it } from "vitest";

describe("Seller dashboard statistics", () => {
  const mockSales = [
    { amount_krw: 10000, seller_amount: 8000, created_at: "2026-04-01T10:00:00Z" },
    { amount_krw: 5000, seller_amount: 4000, created_at: "2026-04-05T10:00:00Z" },
    { amount_krw: 20000, seller_amount: 16000, created_at: "2026-03-15T10:00:00Z" },
    { amount_krw: 15000, seller_amount: 12000, created_at: "2026-03-20T10:00:00Z" },
  ];

  it("calculates total sales count", () => {
    const totalSales = mockSales.length;
    expect(totalSales).toBe(4);
  });

  it("calculates total revenue (seller portion)", () => {
    const totalRevenue = mockSales.reduce((sum, s) => sum + (s.seller_amount ?? 0), 0);
    expect(totalRevenue).toBe(40000);
  });

  it("calculates this month's sales correctly", () => {
    const thisMonthStart = "2026-04-01T00:00:00.000Z";
    const thisMonthSales = mockSales.filter((s) => s.created_at >= thisMonthStart);
    expect(thisMonthSales).toHaveLength(2);
  });

  it("calculates this month's revenue correctly", () => {
    const thisMonthStart = "2026-04-01T00:00:00.000Z";
    const thisMonthSales = mockSales.filter((s) => s.created_at >= thisMonthStart);
    const thisMonthRevenue = thisMonthSales.reduce(
      (sum, s) => sum + (s.seller_amount ?? 0),
      0
    );
    expect(thisMonthRevenue).toBe(12000); // 8000 + 4000
  });
});

describe("Settlement grouping", () => {
  const mockSalesWithSettlement = [
    { seller_amount: 8000, settled: true, created_at: "2026-04-01T10:00:00Z" },
    { seller_amount: 4000, settled: false, created_at: "2026-04-05T10:00:00Z" },
    { seller_amount: 16000, settled: true, created_at: "2026-03-15T10:00:00Z" },
    { seller_amount: 12000, settled: false, created_at: "2026-03-20T10:00:00Z" },
  ];

  it("groups by month correctly", () => {
    const grouped: Record<
      string,
      { month: string; total: number; settled: number; unsettled: number; count: number }
    > = {};

    for (const sale of mockSalesWithSettlement) {
      const month = sale.created_at.slice(0, 7);
      if (!grouped[month]) {
        grouped[month] = { month, total: 0, settled: 0, unsettled: 0, count: 0 };
      }
      grouped[month].total += sale.seller_amount;
      grouped[month].count += 1;
      if (sale.settled) {
        grouped[month].settled += sale.seller_amount;
      } else {
        grouped[month].unsettled += sale.seller_amount;
      }
    }

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["2026-04"].total).toBe(12000);
    expect(grouped["2026-04"].settled).toBe(8000);
    expect(grouped["2026-04"].unsettled).toBe(4000);
    expect(grouped["2026-04"].count).toBe(2);
    expect(grouped["2026-03"].total).toBe(28000);
    expect(grouped["2026-03"].settled).toBe(16000);
    expect(grouped["2026-03"].unsettled).toBe(12000);
  });

  it("sorts months descending", () => {
    const months = ["2026-03", "2026-04", "2026-01"];
    const sorted = months.sort((a, b) => b.localeCompare(a));
    expect(sorted).toEqual(["2026-04", "2026-03", "2026-01"]);
  });
});
