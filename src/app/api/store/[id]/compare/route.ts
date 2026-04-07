import { createClient } from "@/lib/supabase/server";
import { chat } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { searchChunks, formatContext } from "@/lib/retriever";
import type { Persona } from "@/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// POST /api/store/[id]/compare — 두 페르소나 비교
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingIdA } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { compare_with_listing_id, question } = await request.json();
  if (!compare_with_listing_id || !question) {
    return NextResponse.json(
      { error: "compare_with_listing_id and question required" },
      { status: 400 }
    );
  }

  // 두 리스팅 조회
  const [{ data: listingA }, { data: listingB }] = await Promise.all([
    supabase.from("store_listings").select("*").eq("id", listingIdA).single(),
    supabase
      .from("store_listings")
      .select("*")
      .eq("id", compare_with_listing_id)
      .single(),
  ]);

  if (!listingA || !listingB) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // 접근 권한 확인 (소유자이거나 구매자)
  async function hasAccess(personaId: string, sellerId: string) {
    if (sellerId === user!.id) return true;
    const { data } = await supabase
      .from("purchases")
      .select("id")
      .eq("buyer_id", user!.id)
      .eq("persona_id", personaId)
      .eq("status", "confirmed")
      .single();
    return !!data;
  }

  const [accessA, accessB] = await Promise.all([
    hasAccess(listingA.persona_id, listingA.seller_id),
    hasAccess(listingB.persona_id, listingB.seller_id),
  ]);

  if (!accessA || !accessB) {
    return NextResponse.json(
      { error: "Access denied. Purchase required." },
      { status: 403 }
    );
  }

  // 두 페르소나 조회
  const [{ data: personaA }, { data: personaB }] = await Promise.all([
    supabase.from("personas").select("*").eq("id", listingA.persona_id).single(),
    supabase.from("personas").select("*").eq("id", listingB.persona_id).single(),
  ]);

  if (!personaA || !personaB) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  // 병렬 RAG + LLM 호출
  const [responseA, responseB] = await Promise.all([
    (async () => {
      const results = await searchChunks(personaA.id, question, 5);
      const context = formatContext(results);
      const systemPrompt = buildSystemPrompt(personaA as Persona, context);
      return chat(systemPrompt, [{ role: "user", content: question }]);
    })(),
    (async () => {
      const results = await searchChunks(personaB.id, question, 5);
      const context = formatContext(results);
      const systemPrompt = buildSystemPrompt(personaB as Persona, context);
      return chat(systemPrompt, [{ role: "user", content: question }]);
    })(),
  ]);

  return NextResponse.json({
    persona_a: { name: personaA.name, response: responseA },
    persona_b: { name: personaB.name, response: responseB },
  });
}
