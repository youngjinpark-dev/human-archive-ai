import { createServiceClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-key";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embedding";
import { transcribeAudio } from "@/lib/llm";
import { NextResponse } from "next/server";

export const maxDuration = 120;

// POST /api/external/upload — API 키로 음성 파일 업로드 및 처리
// FormData: file (음성 파일), persona_id (UUID)
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

  // Storage에 업로드
  const filePath = `${keyRecord.user_id}/${personaId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // DB 레코드 생성
  const { data: upload, error: insertError } = await supabase
    .from("file_uploads")
    .insert({
      persona_id: personaId,
      file_name: file.name,
      file_path: filePath,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 트랜스크립션 + 임베딩 처리
  try {
    await supabase
      .from("file_uploads")
      .update({ status: "transcribing" })
      .eq("id", upload.id);

    // Storage에서 다운로드
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error("File download failed");
    }

    // Gemini 트랜스크립션
    const audioBuffer = await fileData.arrayBuffer();
    const mimeType = fileData.type || "audio/mpeg";
    const transcript = await transcribeAudio(audioBuffer, mimeType);

    await supabase
      .from("file_uploads")
      .update({ transcript, status: "embedding" })
      .eq("id", upload.id);

    // 청킹 + 임베딩
    const chunks = chunkText(transcript, {
      source: file.name,
      type: "audio_transcript",
    });

    if (chunks.length > 0) {
      const texts = chunks.map((c) => c.text);
      const embeddings = await embedTexts(texts);

      const rows = chunks.map((c, i) => ({
        persona_id: personaId,
        content: c.text,
        embedding: JSON.stringify(embeddings[i]),
        metadata: c.metadata,
      }));

      await supabase.from("chunks").insert(rows);
    }

    await supabase
      .from("file_uploads")
      .update({ status: "done" })
      .eq("id", upload.id);

    return NextResponse.json({
      success: true,
      upload_id: upload.id,
      transcript_length: transcript.length,
      chunks_count: chunks.length,
    });
  } catch (error) {
    await supabase
      .from("file_uploads")
      .update({ status: "error" })
      .eq("id", upload.id);

    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
