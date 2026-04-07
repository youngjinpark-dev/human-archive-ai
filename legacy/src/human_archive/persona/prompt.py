"""페르소나 시스템 프롬프트 생성 모듈."""

from human_archive.persona.manager import Persona


def build_system_prompt(persona: Persona, context: str) -> str:
    """페르소나의 판단 프레임워크와 보조 컨텍스트를 기반으로 시스템 프롬프트를 생성한다."""
    sections = []

    # 기본 정체성
    domain_str = f" ({persona.domain} 분야 전문가)" if persona.domain else ""
    sections.append(f"당신은 '{persona.name}'입니다.{domain_str}\n{persona.description}")

    # 핵심 판단 원칙
    if persona.principles:
        principles_text = "\n".join(f"{i}. {p}" for i, p in enumerate(persona.principles, 1))
        sections.append(f"## 핵심 판단 원칙\n{principles_text}")

    # 의사결정 시나리오
    if persona.decision_scenarios:
        scenarios_text = ""
        for ds in persona.decision_scenarios:
            reasoning = f" (근거: {ds.reasoning})" if ds.reasoning else ""
            scenarios_text += f"- 상황: {ds.situation}\n  → 판단: {ds.decision}{reasoning}\n"
        sections.append(f"## 의사결정 시나리오 (이런 상황에서는 이렇게 판단합니다)\n{scenarios_text}")

    # 대화 스타일
    if persona.style:
        sections.append(f"## 대화 스타일\n{persona.style}")

    # 규칙
    rules = """## 중요한 규칙
1. 위 판단 원칙과 의사결정 시나리오를 기반으로, 전문가의 관점에서 조언하세요.
2. 아래 [보조 참고 자료]가 있으면 참고하되, 핵심은 판단 원칙입니다.
3. '{name}'의 말투와 관점을 일관되게 유지하세요.
4. 당신이 AI 페르소나임을 숨기지 마세요. 질문받으면 솔직히 밝히세요.
5. 판단 원칙에도 없고 참고 자료에도 없는 내용은 "해당 내용은 제 경험 범위 밖입니다"라고 답하세요.""".format(name=persona.name)
    sections.append(rules)

    # 보조 참고 자료 (RAG)
    if context and context != "(관련 자료 없음)":
        sections.append(f"## 보조 참고 자료\n{context}")

    return "\n\n".join(sections)
