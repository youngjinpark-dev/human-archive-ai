import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/chunker";
import { embedText, embedTexts } from "@/lib/embedding";
import { transcribeAudio } from "@/lib/llm";
import { extractJudgmentPatterns } from "@/lib/judgment-extractor";
import { NextResponse } from "next/server";

export const maxDuration = 300;

// POST /api/files/[id]/process — STT + 임베딩 + 판단 패턴 추출
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
    // 1. 트랜스크립션 (기존 트랜스크립트가 충분하면 재사용)
    let transcript = upload.transcript as string | null;

    if (!transcript || transcript.length < 100) {
      await serviceClient
        .from("file_uploads")
        .update({ status: "transcribing" })
        .eq("id", id);

      const { data: fileData, error: downloadError } = await serviceClient.storage
        .from("uploads")
        .download(upload.file_path);

      if (downloadError || !fileData) {
        throw new Error(`File download failed: ${downloadError?.message ?? "no data"}`);
      }

      const audioBuffer = await fileData.arrayBuffer();
      const mimeType = fileData.type || "audio/mpeg";
      transcript = await transcribeAudio(audioBuffer, mimeType);

      await serviceClient
        .from("file_uploads")
        .update({ transcript, status: "embedding" })
        .eq("id", id);
    } else {
      await serviceClient
        .from("file_uploads")
        .update({ status: "embedding" })
        .eq("id", id);
    }

    // 4. 기존 청크 삭제 (재처리 시 중복 방지)
    await serviceClient
      .from("chunks")
      .delete()
      .eq("persona_id", upload.persona_id)
      .eq("metadata->>source", upload.file_name);

    // 5. 청킹 + 임베딩
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

      await serviceClient.from("chunks").insert(rows);
    }

    // 6. 판단 패턴 추출 (framework 없으면 자동 생성)
    let extractedCount = 0;
    if (transcript.length > 50) {
      try {
        let framework = await serviceClient
          .from("judgment_frameworks")
          .select("*")
          .eq("persona_id", upload.persona_id)
          .single()
          .then((r) => r.data);

        if (!framework) {
          const { data: newFw, error: fwError } = await serviceClient
            .from("judgment_frameworks")
            .insert({ persona_id: upload.persona_id, status: "building" })
            .select()
            .single();
          if (fwError) {
            console.error("Framework creation failed:", fwError);
          }
          framework = newFw;
        }

        if (framework) {
          // 기존 audio 소스 패턴 삭제 (재처리 시 중복 방지)
          await serviceClient.from("if_then_patterns").delete().eq("source_id", id);
          await serviceClient.from("experience_stories").delete().eq("source_id", id);

          const { data: existingAxes } = await serviceClient
            .from("judgment_axes")
            .select("name")
            .eq("framework_id", framework.id);
          const axesNames = (existingAxes ?? []).map((a: { name: string }) => a.name);

          const extraction = await extractJudgmentPatterns(transcript, axesNames);

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

          // framework 상태를 ready로 변경
          if (framework.status === "building") {
            await serviceClient
              .from("judgment_frameworks")
              .update({ status: "ready" })
              .eq("id", framework.id);
          }
        }
      } catch (extractError) {
        console.error("Pattern extraction failed:", extractError);
      }
    }

    // 7. 완료
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
    console.error("Process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
