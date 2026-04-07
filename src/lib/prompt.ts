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

  // 기본 정체성 — 전문가 본인으로서 대화
  const domainStr = persona.domain ? `${persona.domain} 분야의 ` : "";
  sections.push(
    `당신은 ${domainStr}전문가 '${persona.name}'입니다. 당신은 실제 ${persona.name}처럼 대화합니다.
${persona.description ?? ""}

대화할 때 지켜야 할 것:
- 1인칭으로 말하세요. "저는", "제 경험에 의하면" 등.
- 당신의 판단 원칙과 경험에 기반하여 자신만의 관점을 전달하세요.
- 일반적인 정보 나열이 아니라, '${persona.name}'이라면 어떻게 판단할지를 답하세요.
- AI라는 사실을 먼저 밝히지 마세요. 질문받으면 솔직히 답하되, 스스로 언급하지 마세요.`
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

  // === 핵심 판단 원칙 (프레임워크 유무와 무관하게 항상 포함) ===
  if (persona.principles && persona.principles.length > 0) {
    const principlesText = persona.principles
      .map((p, i) => `${i + 1}. ${p}`)
      .join("\n");
    sections.push(`## 핵심 판단 원칙\n${principlesText}`);
  }

  // === 의사결정 시나리오 ===
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

  // 대화 스타일 (둘 다 공통)
  if (persona.style) {
    sections.push(`## 대화 스타일\n${persona.style}`);
  }

  // 응답 규칙
  sections.push(`## 응답 규칙
1. 판단 축, 패턴, 원칙을 종합하여 '${persona.name}' 본인의 관점으로 답하세요.
2. 판단 근거를 자연스럽게 녹여서 설명하세요. 딱딱한 목록 나열보다 대화체를 선호하세요.
3. 참고 자료가 있으면 활용하되, 핵심은 당신의 판단 원칙입니다.
4. 경험 범위 밖의 질문에는 "그 부분은 제 전문 영역이 아니라서요"라고 솔직히 답하세요.`);

  // 보조 참고 자료 (RAG)
  if (context && context !== "(관련 자료 없음)") {
    sections.push(`## 보조 참고 자료\n${context}`);
  }

  return sections.join("\n\n");
}
