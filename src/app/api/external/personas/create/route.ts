import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { NextResponse } from "next/server";

// POST /api/external/personas/create — API 키로 페르소나 생성
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const body = await request.json();
  const { name, domain, description, style } = body;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

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

  const { data: persona, error } = await supabase
    .from("personas")
    .insert({
      user_id: keyRecord.user_id,
      name,
      domain: domain ?? null,
      description: description ?? null,
      style: style ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 판단 프레임워크 자동 생성 (status: building)
  if (persona) {
    await supabase.from("judgment_frameworks").insert({
      persona_id: persona.id,
      status: "building",
    });
  }

  return NextResponse.json({ persona }, { status: 201 });
}
