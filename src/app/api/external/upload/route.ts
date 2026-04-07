import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const maxDuration = 30;

// POST /api/external/upload — 음성 파일 업로드 (Storage 저장만, 처리는 별도)
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const personaId = formData.get("persona_id") as string | null;
  const originalName = formData.get("original_name") as string | null;

  if (!file || !personaId) {
    return NextResponse.json(
      { error: "file and persona_id required" },
      { status: 400 }
    );
  }

  // 페르소나 소유 확인
  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("id", personaId)
    .eq("user_id", keyRecord.user_id)
    .single();

  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  // 파일명 sanitize — UUID + 확장자만 사용 (특수문자 문제 방지)
  const ext = (file.name || "audio.mp3").split(".").pop() || "mp3";
  const safeFileName = `${randomUUID()}.${ext}`;
  const filePath = `${keyRecord.user_id}/${personaId}/${safeFileName}`;
  const displayName = originalName || file.name || safeFileName;

  // Storage에 업로드
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // DB 레코드 생성 (status: uploaded — 아직 처리 안 됨)
  const { data: upload, error: insertError } = await supabase
    .from("file_uploads")
    .insert({
      persona_id: personaId,
      file_name: displayName,
      file_path: filePath,
      status: "uploaded",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      upload_id: upload.id,
      file_name: displayName,
      status: "uploaded",
      message: "파일 업로드 완료. POST /api/external/upload/{id}/process 로 처리를 시작하세요.",
    },
    { status: 201 }
  );
}
