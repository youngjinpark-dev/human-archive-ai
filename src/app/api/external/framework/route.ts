import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { NextResponse } from "next/server";

// GET /api/external/framework — 프레임워크 조회 (API 키 인증)
export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const persona_id = searchParams.get("persona_id");
  const domain = searchParams.get("domain");

  if (!persona_id) {
    return NextResponse.json({ error: "persona_id required" }, { status: 400 });
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
    .select("*")
    .eq("persona_id", persona_id)
    .single();

  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  // 판단 축 조회
  let axesQuery = supabase
    .from("judgment_axes")
    .select("*")
    .eq("framework_id", framework.id)
    .order("weight", { ascending: false });

  if (domain) {
    axesQuery = axesQuery.or(`domain.eq.${domain},domain.is.null`);
  }

  const { data: axes } = await axesQuery;

  // 핵심 패턴 (상위 10개)
  const { data: patterns } = await supabase
    .from("if_then_patterns")
    .select("*")
    .eq("framework_id", framework.id)
    .order("confidence", { ascending: false })
    .limit(10);

  return NextResponse.json({
    axes: axes ?? [],
    key_patterns: patterns ?? [],
    philosophy: framework.philosophy,
    domains: framework.domains ?? [],
  });
}
