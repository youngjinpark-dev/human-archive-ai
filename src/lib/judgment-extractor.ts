import { extract } from "@/lib/llm";
import type { ExtractionResult } from "@/types";

const EXTRACT_ALL_PROMPT = `이 텍스트에서 전문가의 판단 프레임워크 요소를 추출하세요.
인터뷰, 강의, 팟캐스트, 대화 등 어떤 형태든 전문가의 사고 방식을 파악하여 추출합니다.

3가지를 추출합니다:

1. axes (판단 축): 이 전문가가 중요하게 여기는 판단 기준이나 가치관. 명시적으로 말하지 않더라도 행간에서 읽히는 기준도 포함.
2. patterns (판단 패턴): 전문가의 행동 규칙. "이런 상황에서는 이렇게 한다"는 패턴. 직접적인 조언, 추천, 주장, 습관 등에서 추출. 예: "새 도구를 도입할 때는 → 작은 범위에서 먼저 테스트한다"
3. stories (경험 스토리): 전문가가 언급한 구체적 사례, 경험, 에피소드. 도구 도입 경험, 실패담, 성공담, 비교 경험 등.

최대한 많이 추출하세요. 없는 항목은 빈 배열로 응답. JSON으로만 응답:
{
  "axes": [{"name": "축이름", "description": "설명", "weight": 0.8, "domain": null}],
  "patterns": [{"condition": "상황", "action": "전문가의 행동/판단", "reasoning": "근거"}],
  "stories": [{"title": "제목", "summary": "요약", "context": "상황", "decision": "판단/선택", "outcome": "결과 또는 null", "lesson": "교훈 또는 null"}]
}`;

interface RawAxis {
  name: string;
  description: string;
  weight: number;
  domain: string | null;
}

interface RawPattern {
  condition: string;
  action: string;
  reasoning: string;
}

interface RawStory {
  title: string;
  summary: string;
  context: string;
  decision: string;
  outcome: string | null;
  lesson: string | null;
}

const CHUNK_SIZE = 5000;

/**
 * 텍스트를 CHUNK_SIZE 단위로 분할한다 (문장 경계 존중).
 */
function splitForExtraction(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const segments: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    // 문장 경계에서 자르기
    if (end < text.length) {
      const lastBreak = text.lastIndexOf(".", end);
      const lastQuestion = text.lastIndexOf("?", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const best = Math.max(lastBreak, lastQuestion, lastNewline);
      if (best > start + CHUNK_SIZE * 0.5) end = best + 1;
    }
    segments.push(text.slice(start, end));
    start = end;
  }
  return segments;
}

/**
 * 텍스트에서 판단 패턴을 추출한다.
 * 긴 텍스트는 여러 구간으로 나눠 추출 후 병합한다.
 */
export async function extractJudgmentPatterns(
  text: string,
  existingAxesNames: string[] = []
): Promise<ExtractionResult> {
  const segments = splitForExtraction(text);
  const allAxes: RawAxis[] = [];
  const allPatterns: RawPattern[] = [];
  const allStories: RawStory[] = [];

  // 구간별 순차 추출 (병렬 시 rate limit 위험)
  let currentAxesNames = [...existingAxesNames];
  for (const segment of segments) {
    const contextHint =
      currentAxesNames.length > 0
        ? `\n\n기존 판단 축: ${currentAxesNames.join(", ")}. 기존 축과 동일하면 새로 추출하지 말고, 보강 근거로만 추출하세요.`
        : "";

    const rawResult = await extract<{
      axes?: RawAxis[];
      patterns?: RawPattern[];
      stories?: RawStory[];
    }>(segment, EXTRACT_ALL_PROMPT + contextHint);

    if (rawResult) {
      const axes = Array.isArray(rawResult.axes) ? rawResult.axes : [];
      allAxes.push(...axes);
      allPatterns.push(...(Array.isArray(rawResult.patterns) ? rawResult.patterns : []));
      allStories.push(...(Array.isArray(rawResult.stories) ? rawResult.stories : []));
      // 다음 구간에서 이미 추출된 축을 참고하여 중복 방지
      currentAxesNames.push(...axes.map((a) => a.name).filter(Boolean));
    }
  }

  // 기존 축과 매칭하여 신규/보강 분류
  const newAxes: ExtractionResult["newAxes"] = [];
  const reinforcedAxes: ExtractionResult["reinforcedAxes"] = [];
  const seenAxisNames = new Set<string>();

  for (const axis of allAxes) {
    if (!axis.name || seenAxisNames.has(axis.name)) continue;
    seenAxisNames.add(axis.name);

    const existing = existingAxesNames.find(
      (n) => n === axis.name || n.includes(axis.name) || axis.name.includes(n)
    );
    if (existing) {
      reinforcedAxes.push({
        axisName: existing,
        newEvidence: axis.description ?? "",
      });
    } else {
      newAxes.push({
        name: axis.name,
        description: axis.description ?? "",
        weight: Math.max(0, Math.min(1, axis.weight ?? 0.5)),
        domain: axis.domain ?? null,
      });
    }
  }

  // 중복 패턴 제거 (condition 기준)
  const seenConditions = new Set<string>();
  const uniquePatterns = allPatterns.filter((p) => {
    if (!p.condition || !p.action || seenConditions.has(p.condition)) return false;
    seenConditions.add(p.condition);
    return true;
  });

  // 중복 스토리 제거 (title 기준)
  const seenTitles = new Set<string>();
  const uniqueStories = allStories.filter((s) => {
    if (!s.title || !s.context || !s.decision || seenTitles.has(s.title)) return false;
    seenTitles.add(s.title);
    return true;
  });

  return {
    newAxes,
    reinforcedAxes,
    newPatterns: uniquePatterns.map((p) => ({
      condition: p.condition,
      action: p.action,
      reasoning: p.reasoning ?? "",
    })),
    newStories: uniqueStories.map((s) => ({
      title: s.title,
      summary: s.summary ?? "",
      context: s.context,
      decision: s.decision,
      outcome: s.outcome ?? null,
      lesson: s.lesson ?? null,
    })),
  };
}
