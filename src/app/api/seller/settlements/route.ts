import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/seller/settlements — 판매자 정산 내역
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sales } = await supabase
    .from("purchases")
    .select("id, amount_krw, seller_amount, platform_amount, settled, settled_at, created_at")
    .eq("seller_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  if (!sales || sales.length === 0) {
    return NextResponse.json({ settlements: [] });
  }

  // 월별 그룹핑
  const grouped: Record<
    string,
    { month: string; total: number; settled: number; unsettled: number; count: number }
  > = {};

  for (const sale of sales) {
    const month = sale.created_at.slice(0, 7); // YYYY-MM
    if (!grouped[month]) {
      grouped[month] = { month, total: 0, settled: 0, unsettled: 0, count: 0 };
    }
    const amount = sale.seller_amount ?? 0;
    grouped[month].total += amount;
    grouped[month].count += 1;
    if (sale.settled) {
      grouped[month].settled += amount;
    } else {
      grouped[month].unsettled += amount;
    }
  }

  const settlements = Object.values(grouped).sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  return NextResponse.json({ settlements });
}
