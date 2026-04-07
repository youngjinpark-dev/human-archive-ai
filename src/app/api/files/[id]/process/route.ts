import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/chunker";
import { embedText, embedTexts } from "@/lib/embedding";
import { transcribeAudio } from "@/lib/llm";
import { extractJudgmentPatterns } from "@/lib/judgment-extractor";
import { NextResponse } from "next/server";

export const maxDuration = 120; // Vercel Pro: 최대 120초

// POST /api/files/[id]/process — STT(Gemini) + 임베딩(OpenAI)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 파일 레코드 조회
  const { data: upload } = await supabase
    .from("file_uploads")
    .select("*, personas!inner(user_id)")
    .eq("id", id)
    .single();

  if (!upload || upload.personas.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const serviceClient = createServiceClient();

  try {
    // 1. 상태 업데이트: transcribing
    await serviceClient
      .from("file_uploads")
      .update({ status: "transcribing" })
      .eq("id", id);

    // 2. Storage에서 파일 다운로드
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(upload.file_path);

    if (downloadError || !fileData) {
      throw new Error("File download failed");
    }

    // 3. Gemini 네이티브 오디오 트랜스크립션 (Whisper 대체, 무료)
    const audioBuffer = await fileData.arrayBuffer();
    const mimeType = fileData.type || "audio/mpeg";
    const transcript = await transcribeAudio(audioBuffer, mimeType);

    // transcript 저장
    await serviceClient
      .from("file_uploads")
      .update({ transcript, status: "embedding" })
      .eq("id", id);

    // 4. 청킹
    const chunks = chunkText(transcript, {
      source: upload.file_name,
      type: "audio_transcript",
    });

    if (chunks.length > 0) {
      // 5. 배치 임베딩 (OpenAI — 저비용, 안정적)
      const texts = chunks.map((c) => c.text);
      const embeddings = await embedTexts(texts);

      // 6. pgvector에 저장
      const rows = chunks.map((c, i) => ({
        persona_id: upload.persona_id,
        content: c.text,
        embedding: JSON.stringify(embeddings[i]),
        metadata: c.metadata,
      }));

      await serviceClient.from("chunks").insert(rows);
    }

    // 7. 판단 패턴 추출 (프레임워크가 있는 경우)
    let extractedCount = 0;
    const { data: framework } = await serviceClient
      .from("judgment_frameworks")
      .select("*")
      .eq("persona_id", upload.persona_id)
      .single();

    if (framework && transcript.length > 50) {
      try {
        const { data: existingAxes } = await serviceClient
          .from("judgment_axes")
          .select("name")
          .eq("framework_id", framework.id);
        const axesNames = (existingAxes ?? []).map((a: { name: string }) => a.name);

        const extraction = await extractJudgmentPatterns(transcript, axesNames);

        // 새 축 저장
        for (const axis of extraction.newAxes) {
          await serviceClient.from("judgment_axes").insert({
            framework_id: framework.id,
            name: axis.name,
            description: axis.description,
            weight: axis.weight,
            domain: axis.domain,
            evidence_count: 1,
          });
        }

        // 기존 축 보강
        for (const reinforced of extraction.reinforcedAxes) {
          const { data: axis } = await serviceClient
            .from("judgment_axes")
            .select("evidence_count")
            .eq("framework_id", framework.id)
            .eq("name", reinforced.axisName)
            .single();
          if (axis) {
            await serviceClient
              .from("judgment_axes")
              .update({ evidence_count: (axis.evidence_count ?? 0) + 1 })
              .eq("framework_id", framework.id)
              .eq("name", reinforced.axisName);
          }
        }

        // If-Then 패턴 저장
        for (const pattern of extraction.newPatterns) {
          await serviceClient.from("if_then_patterns").insert({
            framework_id: framework.id,
            condition: pattern.condition,
            action: pattern.action,
            reasoning: pattern.reasoning,
            confidence: 0.5,
            source_type: "audio",
            source_id: id,
          });
        }

        // 경험 스토리 저장
        for (const story of extraction.newStories) {
          const storyEmbedding = await embedText(
            `${story.title} ${story.summary} ${story.context}`
          );
          await serviceClient.from("experience_stories").insert({
            framework_id: framework.id,
            title: story.title,
            summary: story.summary,
            context: story.context,
            decision: story.decision,
            outcome: story.outcome,
            lesson: story.lesson,
            embedding: JSON.stringify(storyEmbedding),
            source_type: "audio",
            source_id: id,
          });
        }

        extractedCount =
          extraction.newAxes.length +
          extraction.newPatterns.length +
          extraction.newStories.length;
      } catch {
        // 추출 실패해도 기존 파이프라인 결과는 유지
      }
    }

    // 8. 완료
    await serviceClient
      .from("file_uploads")
      .update({ status: "done" })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      chunks_count: chunks.length,
      transcript_length: transcript.length,
      judgment_extracted: extractedCount,
    });
  } catch (error) {
    await serviceClient
      .from("file_uploads")
      .update({ status: "error" })
      .eq("id", id);

    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
