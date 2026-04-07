import { extract } from "@/lib/llm";
import type { ExtractionResult } from "@/types";

const EXTRACT_AXES_PROMPT = `이 텍스트에서 전문가의 판단 축(의사결정 시 고려하는 핵심 기준)을 추출하세요.

각 축에 대해:
- name: 축 이름 (간결하게, 예: "확장성", "운영 복잡도")
- description: 이 축이 의미하는 것
- weight: 이 전문가가 얼마나 중시하는지 (0~1, 언급 빈도와 강조 정도로 추정)
- domain: 적용 분야 (null이면 범용)

JSON 배열로만 응답:
[{"name": "...", "description": "...", "weight": 0.8, "domain": null}]`;

const EXTRACT_PATTERNS_PROMPT = `이 텍스트에서 전문가의 판단 패턴(If-Then 규칙)을 추출하세요.

각 패턴에 대해:
- condition: 조건 ("IF ..." 형식, 구체적으로)
- action: 행동 ("THEN ..." 형식, 실행 가능하게)
- reasoning: 이 패턴의 근거 (전문가가 왜 이렇게 하는지)

JSON 배열로만 응답:
[{"condition": "팀 규모 5명 미만이고 데드라인 6개월 이내", "action": "팀이 익숙한 기술 선택", "reasoning": "학습 비용이 프로젝트 리스크 증가"}]`;

const EXTRACT_STORIES_PROMPT = `이 텍스트에서 전문가의 구체적 경험 스토리를 추출하세요.

각 스토리에 대해:
- title: 제목 (한 줄 요약)
- summary: 요약 (2~3문장)
- context: 상황 배경 (어떤 상황이었는지)
- decision: 당시의 판단 (무엇을 결정했는지)
- outcome: 결과 (어떻게 되었는지, 모르면 null)
- lesson: 교훈 (이 경험에서 배운 것)

JSON 배열로만 응답:
[{"title": "...", "summary": "...", "context": "...", "decision": "...", "outcome": "...", "lesson": "..."}]`;

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

  // 순차 호출로 rate limit 방지
  const rawAxes = await extract<RawAxis[]>(text, EXTRACT_AXES_PROMPT + contextHint);
  const rawPatterns = await extract<RawPattern[]>(text, EXTRACT_PATTERNS_PROMPT);
  const rawStories = await extract<RawStory[]>(text, EXTRACT_STORIES_PROMPT);

  const axes = Array.isArray(rawAxes) ? rawAxes : [];
  const patterns = Array.isArray(rawPatterns) ? rawPatterns : [];
  const stories = Array.isArray(rawStories) ? rawStories : [];

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
