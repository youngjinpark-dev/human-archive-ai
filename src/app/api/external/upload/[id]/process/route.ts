import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embedding";
import { transcribeAudio } from "@/lib/llm";
import { NextResponse } from "next/server";

export const maxDuration = 300;

// POST /api/external/upload/[id]/process — 업로드된 파일의 STT + 임베딩 처리
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: uploadId } = await params;

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

  // 업로드 레코드 조회
  const { data: upload } = await supabase
    .from("file_uploads")
    .select("*")
    .eq("id", uploadId)
    .single();

  if (!upload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  // 이미 처리 완료된 경우
  if (upload.status === "done") {
    return NextResponse.json({
      upload_id: upload.id,
      status: "done",
      message: "이미 처리 완료된 파일입니다.",
    });
  }

  // 이미 처리 중인 경우
  if (upload.status === "transcribing" || upload.status === "embedding") {
    return NextResponse.json({
      upload_id: upload.id,
      status: upload.status,
      message: "현재 처리 중입니다. 잠시 후 다시 확인하세요.",
    });
  }

  // 페르소나 소유 확인
  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("id", upload.persona_id)
    .eq("user_id", keyRecord.user_id)
    .single();

  if (!persona) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    // 1. STT 시작
    await supabase
      .from("file_uploads")
      .update({ status: "transcribing" })
      .eq("id", uploadId);

    // 2. Storage에서 다운로드
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(upload.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Storage download failed: ${downloadError?.message ?? "no data"}`);
    }

    // 3. Gemini 트랜스크립션 (5MB 초과 시 자동으로 File API 사용)
    const audioBuffer = await fileData.arrayBuffer();
    const mimeType = fileData.type || "audio/mpeg";
    const transcript = await transcribeAudio(audioBuffer, mimeType);

    await supabase
      .from("file_uploads")
      .update({ transcript, status: "embedding" })
      .eq("id", uploadId);

    // 4. 청킹 + 임베딩
    const chunks = chunkText(transcript, {
      source: upload.file_name,
      type: "audio_transcript",
    });

    if (chunks.length > 0) {
      const texts = chunks.map((c) => c.text);
      const embeddings = await embedTexts(texts);

      const rows = chunks.map((c, i) => ({
        persona_id: upload.persona_id,
        content: c.text,
        embedding: JSON.stringify(embeddings[i]),
        metadata: c.metadata,
      }));

      await supabase.from("chunks").insert(rows);
    }

    // 5. 완료
    await supabase
      .from("file_uploads")
      .update({ status: "done" })
      .eq("id", uploadId);

    return NextResponse.json({
      upload_id: uploadId,
      status: "done",
      transcript_length: transcript.length,
      chunks_count: chunks.length,
    });
  } catch (error) {
    await supabase
      .from("file_uploads")
      .update({ status: "error" })
      .eq("id", uploadId);

    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
