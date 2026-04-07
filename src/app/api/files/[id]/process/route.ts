import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/chunker";
import { embedText, embedTexts } from "@/lib/embedding";
import { transcribeAudio } from "@/lib/llm";
import { extractJudgmentPatterns } from "@/lib/judgment-extractor";
import { NextResponse } from "next/server";
import { after } from "next/server";

export const maxDuration = 300;

// POST /api/files/[id]/process — STT + 임베딩 (백그라운드 처리)
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

  // 즉시 응답 반환 — 처리는 after()로 백그라운드에서 계속
  after(async () => {
    await processUpload(id, upload);
  });

  return NextResponse.json({
    upload_id: id,
    status: "processing",
    message: "처리가 시작되었습니다. 페이지를 나가도 백그라운드에서 계속됩니다.",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processUpload(id: string, upload: any) {
  const serviceClient = createServiceClient();

  try {
    // 1. 상태 업데이트: transcribing
    await serviceClient
      .from("file_uploads")
      .update({ status: "transcribing" })
      .eq("id", id);

    // 2. Storage에서 파일 다운로드
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("uploads")
      .download(upload.file_path);

    if (downloadError || !fileData) {
      throw new Error(`File download failed: ${downloadError?.message ?? "no data"}`);
    }

    // 3. Gemini 트랜스크립션 (5MB 초과 시 File API 자동 사용)
    const audioBuffer = await fileData.arrayBuffer();
    const mimeType = fileData.type || "audio/mpeg";
    const transcript = await transcribeAudio(audioBuffer, mimeType);

    await serviceClient
      .from("file_uploads")
      .update({ transcript, status: "embedding" })
      .eq("id", id);

    // 4. 청킹 + 임베딩
    const chunks = chunkText(transcript, {
      source: upload.file_name,
      type: "audio_transcript",
    });

    if (chunks.length > 0) {
      const texts = chunks.map((c: { text: string }) => c.text);
      const embeddings = await embedTexts(texts);

      const rows = chunks.map((c: { text: string; metadata: Record<string, unknown> }, i: number) => ({
        persona_id: upload.persona_id,
        content: c.text,
        embedding: JSON.stringify(embeddings[i]),
        metadata: c.metadata,
      }));

      await serviceClient.from("chunks").insert(rows);
    }

    // 5. 판단 패턴 추출 (framework 없으면 자동 생성)
    if (transcript.length > 50) {
      try {
        console.log(`[process] Starting pattern extraction for ${id}, transcript length: ${transcript.length}`);

        let framework = await serviceClient
          .from("judgment_frameworks")
          .select("*")
          .eq("persona_id", upload.persona_id)
          .single()
          .then((r) => r.data);

        if (!framework) {
          console.log(`[process] No framework found, creating one for persona ${upload.persona_id}`);
          const { data: newFw, error: fwError } = await serviceClient
            .from("judgment_frameworks")
            .insert({ persona_id: upload.persona_id, status: "building" })
            .select()
            .single();
          if (fwError) console.error(`[process] Framework creation failed:`, fwError);
          framework = newFw;
        }

        if (framework) {
          console.log(`[process] Framework ${framework.id}, extracting patterns...`);
          const { data: existingAxes } = await serviceClient
            .from("judgment_axes")
            .select("name")
            .eq("framework_id", framework.id);
          const axesNames = (existingAxes ?? []).map((a: { name: string }) => a.name);

          const extraction = await extractJudgmentPatterns(transcript, axesNames);
          console.log(`[process] Extracted: ${extraction.newAxes.length} axes, ${extraction.newPatterns.length} patterns, ${extraction.newStories.length} stories`);

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

          // framework 상태를 ready로 변경
          if (framework.status === "building") {
            await serviceClient
              .from("judgment_frameworks")
              .update({ status: "ready" })
              .eq("id", framework.id);
          }
        }
      } catch (extractError) {
        console.error(`[process] Pattern extraction failed for ${id}:`, extractError);
        // 추출 실패해도 기존 파이프라인 결과는 유지
      }
    }

    // 6. 완료
    await serviceClient
      .from("file_uploads")
      .update({ status: "done" })
      .eq("id", id);
  } catch (error) {
    await serviceClient
      .from("file_uploads")
      .update({ status: "error" })
      .eq("id", id);
    console.error("Process error:", error);
  }
}
