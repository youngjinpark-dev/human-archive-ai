import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/chunker";
import { embedText, embedTexts } from "@/lib/embedding";
import { transcribeAudio, extract } from "@/lib/llm";
import { extractJudgmentPatterns } from "@/lib/judgment-extractor";
import { NextResponse } from "next/server";

export const maxDuration = 300;

interface PersonaProfile {
  principles: string[];
  decision_scenarios: { situation: string; decision: string; reasoning?: string }[];
  style: string;
}

// POST /api/files/[id]/process — STT + 임베딩 + 판단 프레임워크 + 프로필 추출
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: upload } = await supabase
    .from("file_uploads")
    .select("*, personas!inner(user_id)")
    .eq("id", id)
    .single();

  if (!upload || upload.personas.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sc = createServiceClient();

  try {
    // ── 1. 트랜스크립션 (기존 트랜스크립트가 충분하면 재사용) ──
    let transcript = upload.transcript as string | null;

    if (!transcript || transcript.length < 100) {
      await sc.from("file_uploads").update({ status: "transcribing" }).eq("id", id);

      const { data: fileData, error: dlErr } = await sc.storage.from("uploads").download(upload.file_path);
      if (dlErr || !fileData) throw new Error(`Download failed: ${dlErr?.message ?? "no data"}`);

      const buf = await fileData.arrayBuffer();
      transcript = await transcribeAudio(buf, fileData.type || "audio/mpeg");

      await sc.from("file_uploads").update({ transcript, status: "embedding" }).eq("id", id);
    } else {
      await sc.from("file_uploads").update({ status: "embedding" }).eq("id", id);
    }

    // ── 2. 기존 청크 삭제 + 재생성 ──
    await sc.from("chunks").delete()
      .eq("persona_id", upload.persona_id)
      .eq("metadata->>source", upload.file_name);

    const chunks = chunkText(transcript, { source: upload.file_name, type: "audio_transcript" });

    if (chunks.length > 0) {
      const embeddings = await embedTexts(chunks.map((c) => c.text));
      await sc.from("chunks").insert(
        chunks.map((c, i) => ({
          persona_id: upload.persona_id,
          content: c.text,
          embedding: JSON.stringify(embeddings[i]),
          metadata: c.metadata,
        }))
      );
    }

    // ── 3. 프레임워크 확보 ──
    let framework = await sc.from("judgment_frameworks")
      .select("*").eq("persona_id", upload.persona_id).single().then((r) => r.data);

    if (!framework) {
      const { data: newFw } = await sc.from("judgment_frameworks")
        .insert({ persona_id: upload.persona_id, status: "building" })
        .select().single();
      framework = newFw;
    }

    // ── 4. 병렬 추출: 프레임워크(축/패턴/스토리) + 페르소나 프로필(원칙/시나리오/스타일) ──
    const profileText = transcript.length > 8000 ? transcript.slice(0, 8000) : transcript;

    const [frameworkResult, profileResult] = await Promise.allSettled([
      // A: 프레임워크 추출 (다단계)
      extractJudgmentPatterns(transcript, []),

      // B: 페르소나 프로필 추출 (1회 호출)
      extract<PersonaProfile>(profileText,
        `이 텍스트에서 전문가의 프로필을 추출하세요.

1. principles: 이 전문가의 핵심 판단 원칙 (3~5개의 문장 배열)
2. decision_scenarios: 전문가가 언급한 의사결정 사례 (situation, decision, reasoning)
3. style: 이 전문가의 말투/대화 스타일을 한 문장으로 묘사

JSON으로만 응답:
{
  "principles": ["원칙1", "원칙2"],
  "decision_scenarios": [{"situation": "상황", "decision": "판단", "reasoning": "근거"}],
  "style": "대화 스타일 묘사"
}`
      ),
    ]);

    // ── 5. 프레임워크 결과 저장 ──
    if (framework && frameworkResult.status === "fulfilled") {
      const extraction = frameworkResult.value;

      // 기존 audio 소스 데이터 삭제 (재처리 중복 방지)
      await sc.from("if_then_patterns").delete().eq("source_id", id);
      await sc.from("experience_stories").delete().eq("source_id", id);
      await sc.from("judgment_axes").delete().eq("framework_id", framework.id);

      for (const axis of extraction.newAxes) {
        await sc.from("judgment_axes").insert({
          framework_id: framework.id,
          name: axis.name, description: axis.description,
          weight: axis.weight, domain: axis.domain, evidence_count: 1,
        });
      }

      for (const pattern of extraction.newPatterns) {
        await sc.from("if_then_patterns").insert({
          framework_id: framework.id,
          condition: pattern.condition, action: pattern.action,
          reasoning: pattern.reasoning, confidence: 0.5,
          source_type: "audio", source_id: id,
        });
      }

      for (const story of extraction.newStories) {
        const emb = await embedText(`${story.title} ${story.summary} ${story.context}`);
        await sc.from("experience_stories").insert({
          framework_id: framework.id,
          title: story.title, summary: story.summary, context: story.context,
          decision: story.decision, outcome: story.outcome, lesson: story.lesson,
          embedding: JSON.stringify(emb), source_type: "audio", source_id: id,
        });
      }

      if (framework.status === "building") {
        await sc.from("judgment_frameworks").update({ status: "ready" }).eq("id", framework.id);
      }
    }

    // ── 6. 페르소나 프로필 저장 ──
    if (profileResult.status === "fulfilled" && profileResult.value) {
      const profile = profileResult.value;
      const updates: Record<string, unknown> = {};

      if (profile.principles?.length > 0) {
        const { data: existing } = await sc.from("personas").select("principles").eq("id", upload.persona_id).single();
        const merged = [...new Set([...(existing?.principles ?? []), ...profile.principles])];
        updates.principles = merged;
      }

      if (profile.decision_scenarios?.length > 0) {
        const { data: existing } = await sc.from("personas").select("decision_scenarios").eq("id", upload.persona_id).single();
        const merged = [...(existing?.decision_scenarios ?? []), ...profile.decision_scenarios];
        updates.decision_scenarios = merged;
      }

      if (profile.style) {
        updates.style = profile.style;
      }

      if (Object.keys(updates).length > 0) {
        await sc.from("personas").update(updates).eq("id", upload.persona_id);
      }
    }

    // ── 7. 완료 ──
    await sc.from("file_uploads").update({ status: "done" }).eq("id", id);

    return NextResponse.json({
      success: true,
      chunks_count: chunks.length,
      transcript_length: transcript.length,
    });
  } catch (error) {
    await sc.from("file_uploads").update({ status: "error" }).eq("id", id);
    const message = error instanceof Error ? error.message : "Processing failed";
    console.error("Process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
