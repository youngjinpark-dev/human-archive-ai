import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extract } from "@/lib/llm";
import { extractJudgmentPatterns } from "@/lib/judgment-extractor";
import { embedText } from "@/lib/embedding";
import { NextResponse } from "next/server";

export const maxDuration = 120;

type RegenerateItem = "principles" | "scenarios" | "style" | "axes" | "patterns";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: personaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: persona } = await supabase
    .from("personas")
    .select("id, user_id")
    .eq("id", personaId)
    .eq("user_id", user.id)
    .single();

  if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { items } = (await request.json()) as { items: RegenerateItem[] };
  if (!items?.length) return NextResponse.json({ error: "items required" }, { status: 400 });

  const sc = createServiceClient();

  // 트랜스크립트 가져오기
  const { data: upload } = await sc
    .from("file_uploads")
    .select("transcript")
    .eq("persona_id", personaId)
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!upload?.transcript) {
    return NextResponse.json({ error: "트랜스크립트가 없습니다. 먼저 파일을 업로드하세요." }, { status: 400 });
  }

  const text = upload.transcript.length > 8000 ? upload.transcript.slice(0, 8000) : upload.transcript;
  const results: Record<string, boolean> = {};

  // principles
  if (items.includes("principles")) {
    try {
      const extracted = await extract<string[]>(text,
        "이 텍스트에서 전문가의 핵심 판단 원칙을 3~5개 추출하세요. 각 원칙은 한 문장으로 표현하세요. JSON 배열로만 응답: [\"원칙1\", \"원칙2\"]"
      );
      if (extracted && extracted.length > 0) {
        await sc.from("personas").update({ principles: extracted }).eq("id", personaId);
        results.principles = true;
      } else {
        results.principles = false;
      }
    } catch { results.principles = false; }
  }

  // scenarios
  if (items.includes("scenarios")) {
    try {
      const extracted = await extract<{ situation: string; decision: string; reasoning?: string }[]>(text,
        `이 텍스트에서 전문가의 의사결정 사례를 2~4개 추출하세요. JSON 배열로만 응답:
[{"situation": "상황", "decision": "판단/선택", "reasoning": "근거"}]`
      );
      if (extracted && extracted.length > 0) {
        await sc.from("personas").update({ decision_scenarios: extracted }).eq("id", personaId);
        results.scenarios = true;
      } else {
        results.scenarios = false;
      }
    } catch { results.scenarios = false; }
  }

  // style
  if (items.includes("style")) {
    try {
      const extracted = await extract<{ style: string }>(text,
        "이 텍스트의 화자의 말투와 대화 스타일을 한 문장으로 묘사하세요. JSON으로만 응답: {\"style\": \"스타일 묘사\"}"
      );
      if (extracted?.style) {
        await sc.from("personas").update({ style: extracted.style }).eq("id", personaId);
        results.style = true;
      } else {
        results.style = false;
      }
    } catch { results.style = false; }
  }

  // axes + patterns
  if (items.includes("axes") || items.includes("patterns")) {
    try {
      let framework = await sc.from("judgment_frameworks")
        .select("*").eq("persona_id", personaId).single().then((r) => r.data);

      if (!framework) {
        const { data: newFw } = await sc.from("judgment_frameworks")
          .insert({ persona_id: personaId, status: "building" })
          .select().single();
        framework = newFw;
      }

      if (framework) {
        const extraction = await extractJudgmentPatterns(upload.transcript, []);

        if (items.includes("axes") && extraction.newAxes.length > 0) {
          await sc.from("judgment_axes").delete().eq("framework_id", framework.id);
          for (const axis of extraction.newAxes) {
            await sc.from("judgment_axes").insert({
              framework_id: framework.id,
              name: axis.name, description: axis.description,
              weight: axis.weight, domain: axis.domain, evidence_count: 1,
            });
          }
          results.axes = true;
        }

        if (items.includes("patterns") && extraction.newPatterns.length > 0) {
          await sc.from("if_then_patterns").delete().eq("framework_id", framework.id);
          for (const pattern of extraction.newPatterns) {
            await sc.from("if_then_patterns").insert({
              framework_id: framework.id,
              condition: pattern.condition, action: pattern.action,
              reasoning: pattern.reasoning, confidence: 0.5,
              source_type: "regenerate", source_id: personaId,
            });
          }
          results.patterns = true;
        }

        for (const story of extraction.newStories) {
          const emb = await embedText(`${story.title} ${story.summary} ${story.context}`);
          await sc.from("experience_stories").insert({
            framework_id: framework.id,
            title: story.title, summary: story.summary, context: story.context,
            decision: story.decision, outcome: story.outcome, lesson: story.lesson,
            embedding: JSON.stringify(emb), source_type: "regenerate", source_id: personaId,
          });
        }

        if (framework.status === "building") {
          await sc.from("judgment_frameworks").update({ status: "ready" }).eq("id", framework.id);
        }
      }
    } catch {
      if (items.includes("axes")) results.axes = false;
      if (items.includes("patterns")) results.patterns = false;
    }
  }

  return NextResponse.json({ results });
}
