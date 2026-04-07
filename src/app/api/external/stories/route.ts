import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { embedText } from "@/lib/embedding";
import { NextResponse } from "next/server";

// POST /api/external/stories — 유사 경험 스토리 검색
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { persona_id, query } = body;

  if (!persona_id || !query) {
    return NextResponse.json(
      { error: "persona_id and query required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // API 키 검증
  const keyHash = hashApiKey(apiKey);
  const { data: keyRecord } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("active", true)
    .single();

  if (!keyRecord) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (
    keyRecord.allowed_personas.length > 0 &&
    !keyRecord.allowed_personas.includes(persona_id)
  ) {
    return NextResponse.json(
      { error: "Not authorized for this persona" },
      { status: 403 }
    );
  }

  // 프레임워크 조회
  const { data: framework } = await supabase
    .from("judgment_frameworks")
    .select("id")
    .eq("persona_id", persona_id)
    .single();

  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  // 임베딩 + 유사도 검색
  const queryEmbedding = await embedText(query);
  const { data: stories } = await supabase.rpc("match_stories", {
    query_embedding: queryEmbedding,
    target_framework_id: framework.id,
    match_count: 5,
  });

  return NextResponse.json({
    stories: (stories ?? []).map(
      (s: {
        title: string;
        summary: string;
        context: string;
        decision: string;
        outcome: string | null;
        lesson: string | null;
        similarity: number;
      }) => ({
        title: s.title,
        summary: s.summary,
        context: s.context,
        decision: s.decision,
        outcome: s.outcome,
        lesson: s.lesson,
        relevance: s.similarity,
      })
    ),
  });
}
