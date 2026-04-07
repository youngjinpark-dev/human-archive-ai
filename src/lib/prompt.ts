import type { Persona } from "@/types";

/**
 * 페르소나의 판단 프레임워크와 보조 컨텍스트를 기반으로 시스템 프롬프트를 생성한다.
 * (기존 Python prompt.py의 1:1 포트)
 */
export function buildSystemPrompt(persona: Persona, context: string): string {
  const sections: string[] = [];

  // 기본 정체성
  const domainStr = persona.domain
    ? ` (${persona.domain} 분야 전문가)`
    : "";
  sections.push(
    `당신은 '${persona.name}'입니다.${domainStr}\n${persona.description ?? ""}`
  );

  // 핵심 판단 원칙
  if (persona.principles && persona.principles.length > 0) {
    const principlesText = persona.principles
      .map((p, i) => `${i + 1}. ${p}`)
      .join("\n");
    sections.push(`## 핵심 판단 원칙\n${principlesText}`);
  }

  // 의사결정 시나리오
  if (persona.decision_scenarios && persona.decision_scenarios.length > 0) {
    let scenariosText = "";
    for (const ds of persona.decision_scenarios) {
      const reasoning = ds.reasoning ? ` (근거: ${ds.reasoning})` : "";
      scenariosText += `- 상황: ${ds.situation}\n  → 판단: ${ds.decision}${reasoning}\n`;
    }
    sections.push(
      `## 의사결정 시나리오 (이런 상황에서는 이렇게 판단합니다)\n${scenariosText}`
    );
  }

  // 대화 스타일
  if (persona.style) {
    sections.push(`## 대화 스타일\n${persona.style}`);
  }

  // 규칙
  sections.push(`## 중요한 규칙
1. 위 판단 원칙과 의사결정 시나리오를 기반으로, 전문가의 관점에서 조언하세요.
2. 아래 [보조 참고 자료]가 있으면 참고하되, 핵심은 판단 원칙입니다.
3. '${persona.name}'의 말투와 관점을 일관되게 유지하세요.
4. 당신이 AI 페르소나임을 숨기지 마세요. 질문받으면 솔직히 밝히세요.
5. 판단 원칙에도 없고 참고 자료에도 없는 내용은 "해당 내용은 제 경험 범위 밖입니다"라고 답하세요.`);

  // 보조 참고 자료 (RAG)
  if (context && context !== "(관련 자료 없음)") {
    sections.push(`## 보조 참고 자료\n${context}`);
  }

  return sections.join("\n\n");
}
