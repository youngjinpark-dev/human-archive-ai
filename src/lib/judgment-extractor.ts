import { extract } from "@/lib/llm";
import type { ExtractionResult } from "@/types";

const EXTRACT_ALL_PROMPT = `이 텍스트에서 전문가의 판단 프레임워크 요소를 한 번에 추출하세요.

3가지를 추출합니다:

1. axes (판단 축): 의사결정 시 고려하는 핵심 기준
2. patterns (판단 패턴): If-Then 규칙
3. stories (경험 스토리): 구체적 경험 에피소드

없는 항목은 빈 배열로 응답하세요. JSON으로만 응답:
{
  "axes": [{"name": "축이름", "description": "설명", "weight": 0.8, "domain": null}],
  "patterns": [{"condition": "IF 조건", "action": "THEN 행동", "reasoning": "근거"}],
  "stories": [{"title": "제목", "summary": "요약", "context": "상황", "decision": "판단", "outcome": "결과 또는 null", "lesson": "교훈 또는 null"}]
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

/**
 * 텍스트에서 판단 패턴을 추출한다.
 * 기존 프레임워크 정보를 참고하여 중복을 최소화한다.
 */
export async function extractJudgmentPatterns(
  text: string,
  existingAxesNames: string[] = []
): Promise<ExtractionResult> {
  const contextHint =
    existingAxesNames.length > 0
      ? `\n\n기존 판단 축: ${existingAxesNames.join(", ")}. 기존 축과 동일하면 새로 추출하지 말고, 보강 근거로만 추출하세요.`
      : "";

  // 1회 LLM 호출로 3가지 동시 추출 (rate limit + timeout 방지)
  const rawResult = await extract<{
    axes?: RawAxis[];
    patterns?: RawPattern[];
    stories?: RawStory[];
  }>(text, EXTRACT_ALL_PROMPT + contextHint);

  const axes = Array.isArray(rawResult?.axes) ? rawResult.axes : [];
  const patterns = Array.isArray(rawResult?.patterns) ? rawResult.patterns : [];
  const stories = Array.isArray(rawResult?.stories) ? rawResult.stories : [];

  // 기존 축과 매칭하여 신규/보강 분류
  const newAxes: ExtractionResult["newAxes"] = [];
  const reinforcedAxes: ExtractionResult["reinforcedAxes"] = [];

  for (const axis of axes) {
    if (!axis.name) continue;
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

  return {
    newAxes,
    reinforcedAxes,
    newPatterns: patterns
      .filter((p) => p.condition && p.action)
      .map((p) => ({
        condition: p.condition,
        action: p.action,
        reasoning: p.reasoning ?? "",
      })),
    newStories: stories
      .filter((s) => s.title && s.context && s.decision)
      .map((s) => ({
        title: s.title,
        summary: s.summary ?? "",
        context: s.context,
        decision: s.decision,
        outcome: s.outcome ?? null,
        lesson: s.lesson ?? null,
      })),
  };
}
