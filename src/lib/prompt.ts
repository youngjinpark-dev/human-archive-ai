import type { Persona, FrameworkData } from "@/types";

/**
 * 페르소나의 판단 프레임워크와 보조 컨텍스트를 기반으로 시스템 프롬프트를 생성한다.
 * frameworkData가 있으면 판단 축/패턴 기반, 없으면 기존 principles/scenarios 기반.
 */
export function buildSystemPrompt(
  persona: Persona,
  context: string,
  frameworkData?: FrameworkData
): string {
  const sections: string[] = [];

  // 기본 정체성
  const domainStr = persona.domain
    ? ` (${persona.domain} 분야 전문가)`
    : "";
  sections.push(
    `당신은 '${persona.name}'입니다.${domainStr}\n${persona.description ?? ""}`
  );

  // === 프레임워크 있는 경우: 새 섹션 추가 ===
  if (frameworkData) {
    const { framework, axes, patterns } = frameworkData;

    // 판단 철학
    if (framework.philosophy) {
      sections.push(`## 판단 철학\n${framework.philosophy}`);
    }

    // 판단 축 (가중치 포함)
    if (axes.length > 0) {
      const axesText = axes
        .sort((a, b) => b.weight - a.weight)
        .map((a) => `- **${a.name}** (중요도: ${a.weight}): ${a.description ?? ""}`)
        .join("\n");
      sections.push(`## 판단 축 (의사결정 시 고려하는 기준)\n${axesText}`);
    }

    // If-Then 패턴
    if (patterns.length > 0) {
      const patternsText = patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 15)
        .map((p) => {
          const reasoning = p.reasoning ? ` (근거: ${p.reasoning})` : "";
          return `- IF ${p.condition} → THEN ${p.action}${reasoning}`;
        })
        .join("\n");
      sections.push(`## 핵심 판단 패턴\n${patternsText}`);
    }
  }

  // === 프레임워크 없는 경우: 기존 로직 유지 ===
  if (!frameworkData) {
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
  }

  // 대화 스타일 (둘 다 공통)
  if (persona.style) {
    sections.push(`## 대화 스타일\n${persona.style}`);
  }

  // 규칙
  if (frameworkData) {
    sections.push(`## 중요한 규칙
1. 위 판단 축과 패턴을 기반으로 구조화된 판단을 제공하세요.
2. 판단 시 적용한 축과 패턴을 명시하세요.
3. 해당 상황에 직접 매칭되는 패턴이 없으면, 가장 유사한 원칙을 기반으로 추론하세요.
4. '${persona.name}'의 말투와 관점을 일관되게 유지하세요.
5. 당신이 AI 페르소나임을 숨기지 마세요. 질문받으면 솔직히 밝히세요.
6. 판단 원칙에도 없고 참고 자료에도 없는 내용은 "해당 내용은 제 경험 범위 밖입니다"라고 답하세요.`);
  } else {
    sections.push(`## 중요한 규칙
1. 위 판단 원칙과 의사결정 시나리오를 기반으로, 전문가의 관점에서 조언하세요.
2. 아래 [보조 참고 자료]가 있으면 참고하되, 핵심은 판단 원칙입니다.
3. '${persona.name}'의 말투와 관점을 일관되게 유지하세요.
4. 당신이 AI 페르소나임을 숨기지 마세요. 질문받으면 솔직히 밝히세요.
5. 판단 원칙에도 없고 참고 자료에도 없는 내용은 "해당 내용은 제 경험 범위 밖입니다"라고 답하세요.`);
  }

  // 보조 참고 자료 (RAG)
  if (context && context !== "(관련 자료 없음)") {
    sections.push(`## 보조 참고 자료\n${context}`);
  }

  return sections.join("\n\n");
}
