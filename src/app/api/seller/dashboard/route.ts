import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/seller/dashboard — 판매자 대시보드
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 판매 통계
  const { data: sales } = await supabase
    .from("purchases")
    .select("amount_krw, seller_amount, created_at")
    .eq("seller_id", user.id)
    .eq("status", "confirmed");

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const totalSales = sales?.length ?? 0;
  const totalRevenue = sales?.reduce((sum, s) => sum + (s.seller_amount ?? 0), 0) ?? 0;

  const thisMonthSales = sales?.filter((s) => s.created_at >= thisMonthStart) ?? [];
  const thisMonthSalesCount = thisMonthSales.length;
  const thisMonthRevenue = thisMonthSales.reduce(
    (sum, s) => sum + (s.seller_amount ?? 0),
    0
  );

  // 내 리스팅 목록
  const { data: listings } = await supabase
    .from("store_listings")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    stats: {
      total_sales: totalSales,
      total_revenue: totalRevenue,
      this_month_sales: thisMonthSalesCount,
      this_month_revenue: thisMonthRevenue,
    },
    listings: listings ?? [],
  });
}
