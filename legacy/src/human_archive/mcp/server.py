"""Human Archive MCP 서버.

은퇴 전문가의 판단 체계와 사고방식을 AI에 이식하여,
전문가의 관점에서 조언하는 서비스입니다.
"""

from datetime import datetime

from mcp.server.fastmcp import FastMCP

from human_archive.archive.chunker import chunk_segments
from human_archive.archive.embedder import embed_chunks, get_collection
from human_archive.archive.youtube import extract_subtitles
from human_archive.auth.api_key import create_api_key, revoke_api_key, validate_api_key
from human_archive.chat.engine import chat as chat_with_persona
from human_archive.config import AUTH_ENABLED
from human_archive.interview.questions import (
    get_interview_status,
    get_next_question,
    process_answer,
)
from human_archive.persona.manager import (
    Persona,
    Source,
    add_source_to_persona,
    delete_persona,
    list_personas,
    load_persona,
    save_persona,
)

mcp = FastMCP(
    "Human Archive",
    instructions=(
        "은퇴 전문가의 판단 체계와 사고방식을 AI에 이식하여, "
        "전문가의 관점에서 조언하는 서비스입니다. "
        "interview_start로 전문가 인터뷰를 진행하고, "
        "chat으로 아카이빙된 페르소나와 대화할 수 있습니다."
    ),
)


# ── 인터뷰 Tools ──────────────────────────────────────────


@mcp.tool()
def interview_start(
    persona_name: str,
    domain: str = "",
    description: str = "",
    style: str = "",
) -> str:
    """전문가 인터뷰를 시작합니다. 페르소나가 없으면 새로 생성합니다.

    Args:
        persona_name: 페르소나 이름
        domain: 전문 분야 (예: "금형 설계", "한식 요리")
        description: 페르소나 설명
        style: 대화 스타일 (예: "직설적이고 실무 중심")
    """
    # 페르소나 생성 또는 로드
    try:
        load_persona(persona_name)
    except FileNotFoundError:
        persona = Persona(
            name=persona_name,
            description=description or f"{persona_name}의 AI 페르소나",
            style=style or "",
            domain=domain or "",
        )
        save_persona(persona)

    first_question = get_next_question(persona_name)
    if first_question is None:
        return "인터뷰가 이미 완료된 페르소나입니다."

    return (
        f"'{persona_name}' 인터뷰를 시작합니다.\n\n"
        f"첫 번째 질문:\n**{first_question}**\n\n"
        f"interview_answer로 답변을 제출해주세요."
    )


@mcp.tool()
def interview_answer(persona_name: str, answer: str, session_id: str = "default") -> str:
    """인터뷰 질문에 대한 답변을 제출합니다.

    Args:
        persona_name: 페르소나 이름
        answer: 인터뷰 질문에 대한 답변
        session_id: 세션 ID (기본: default)
    """
    result = process_answer(persona_name, answer, session_id)

    if result["status"] == "completed":
        return (
            f"인터뷰가 완료되었습니다!\n"
            f"'{persona_name}' 페르소나가 준비되었습니다.\n"
            f"이제 chat 도구로 대화할 수 있습니다."
        )

    return (
        f"[{result['phase']}] 답변 저장 완료.\n\n"
        f"다음 질문:\n**{result['next_question']}**"
    )


@mcp.tool()
def interview_status(persona_name: str, session_id: str = "default") -> str:
    """인터뷰 진행 상태를 확인합니다.

    Args:
        persona_name: 페르소나 이름
        session_id: 세션 ID
    """
    status = get_interview_status(persona_name, session_id)
    completed_str = "완료" if status["completed"] else "진행 중"

    return (
        f"## 인터뷰 상태: {persona_name}\n"
        f"- 현재 단계: {status['current_phase']}\n"
        f"- 진행률: {status['progress']}\n"
        f"- 상태: {completed_str}"
    )


# ── 대화 Tool ──────────────────────────────────────────


@mcp.tool()
def chat(persona_name: str, message: str, api_key: str = "") -> str:
    """아카이빙된 페르소나와 대화합니다. 전문가의 판단 관점에서 조언을 받을 수 있습니다.

    Args:
        persona_name: 대화할 페르소나 이름
        message: 사용자 메시지
        api_key: API 키 (인증 활성화 시 필수)
    """
    # 인증 검증
    if AUTH_ENABLED:
        if not api_key:
            return "API 키가 필요합니다. api_key 파라미터를 제공해주세요."
        key_info = validate_api_key(api_key, persona_name)
        if key_info is None:
            return "유효하지 않은 API 키이거나 이 페르소나에 대한 접근 권한이 없습니다."

    try:
        response = chat_with_persona(persona_name, message)
        return response
    except FileNotFoundError:
        return f"페르소나 '{persona_name}'을 찾을 수 없습니다. persona_list로 확인해주세요."
    except Exception as e:
        return f"대화 생성 실패: {e}"


# ── 아카이빙 Tool ──────────────────────────────────────


@mcp.tool()
def archive_youtube(url: str, persona_name: str, description: str = "", style: str = "") -> str:
    """YouTube 영상을 아카이빙하여 페르소나의 보조 참고 자료에 추가합니다.

    Args:
        url: YouTube 영상 URL
        persona_name: 페르소나 이름 (새로 만들거나 기존에 추가)
        description: 페르소나 설명 (새 페르소나일 때)
        style: 대화 스타일 설명
    """
    try:
        video = extract_subtitles(url)
    except Exception as e:
        return f"자막 추출 실패: {e}"

    try:
        load_persona(persona_name)
    except FileNotFoundError:
        persona = Persona(
            name=persona_name,
            description=description or f"{persona_name}의 AI 페르소나",
            style=style or "자연스러운 대화체",
        )
        save_persona(persona)

    source = Source(
        type="youtube",
        url=url,
        title=video.title,
        archived_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    add_source_to_persona(persona_name, source)

    chunks = chunk_segments(video.segments, video.title, url)

    try:
        count = embed_chunks(persona_name, chunks)
    except Exception as e:
        return f"임베딩 실패 (Ollama가 실행 중인지 확인하세요): {e}"

    return (
        f"아카이빙 완료!\n"
        f"- 영상: {video.title}\n"
        f"- 채널: {video.channel}\n"
        f"- 저장된 청크: {count}개 (보조 참고 자료)\n"
        f"- 페르소나: {persona_name}"
    )


# ── 페르소나 관리 Tools ──────────────────────────────────


@mcp.tool()
def persona_list() -> str:
    """등록된 모든 페르소나 목록을 반환합니다."""
    personas = list_personas()
    if not personas:
        return "등록된 페르소나가 없습니다. interview_start로 인터뷰를 시작해주세요."

    lines = []
    for p in personas:
        domain_str = f" [{p.domain}]" if p.domain else ""
        principles_count = len(p.principles)
        scenarios_count = len(p.decision_scenarios)
        lines.append(
            f"- **{p.name}**{domain_str}: {p.description} "
            f"(원칙 {principles_count}개, 시나리오 {scenarios_count}개)"
        )

    return "## 등록된 페르소나\n" + "\n".join(lines)


@mcp.tool()
def persona_info(persona_name: str) -> str:
    """페르소나의 상세 정보를 반환합니다.

    Args:
        persona_name: 조회할 페르소나 이름
    """
    try:
        persona = load_persona(persona_name)
    except FileNotFoundError:
        return f"페르소나 '{persona_name}'을 찾을 수 없습니다."

    collection = get_collection(persona_name)
    chunk_count = collection.count()

    # 판단 원칙
    principles_str = ""
    if persona.principles:
        principles_str = "\n### 판단 원칙\n"
        principles_str += "\n".join(f"{i}. {p}" for i, p in enumerate(persona.principles, 1))

    # 의사결정 시나리오
    scenarios_str = ""
    if persona.decision_scenarios:
        scenarios_str = "\n### 의사결정 시나리오\n"
        for ds in persona.decision_scenarios:
            scenarios_str += f"- **상황**: {ds.situation}\n  **판단**: {ds.decision}\n"

    # 소스
    sources_str = ""
    for s in persona.sources:
        sources_str += f"\n  - [{s.type}] {s.title or s.url} ({s.archived_at})"

    return (
        f"## {persona.name}\n"
        f"- 분야: {persona.domain or '미설정'}\n"
        f"- 설명: {persona.description}\n"
        f"- 스타일: {persona.style or '미설정'}\n"
        f"- 보조 자료 청크: {chunk_count}개\n"
        f"- 소스:{sources_str or ' 없음'}"
        f"{principles_str}"
        f"{scenarios_str}"
    )


@mcp.tool()
def persona_delete(persona_name: str) -> str:
    """페르소나를 삭제합니다.

    Args:
        persona_name: 삭제할 페르소나 이름
    """
    deleted = delete_persona(persona_name)

    try:
        from human_archive.archive.embedder import get_chroma_client, _sanitize_name
        client = get_chroma_client()
        client.delete_collection(_sanitize_name(persona_name))
    except Exception:
        pass

    if deleted:
        return f"페르소나 '{persona_name}'이 삭제되었습니다."
    return f"페르소나 '{persona_name}'을 찾을 수 없습니다."


# ── API 키 관리 Tools ──────────────────────────────────


@mcp.tool()
def api_key_create(owner: str, allowed_personas: str = "") -> str:
    """새 API 키를 생성합니다 (관리자용).

    Args:
        owner: 키 소유자 이름
        allowed_personas: 접근 가능 페르소나 (쉼표 구분, 비어있으면 전체 접근)
    """
    personas_list = (
        [p.strip() for p in allowed_personas.split(",") if p.strip()]
        if allowed_personas
        else None
    )
    key = create_api_key(owner, personas_list)

    access_str = ", ".join(personas_list) if personas_list else "전체"
    return (
        f"API 키 생성 완료!\n"
        f"- 키: `{key}`\n"
        f"- 소유자: {owner}\n"
        f"- 접근 가능: {access_str}\n\n"
        f"이 키를 안전하게 보관하세요."
    )


@mcp.tool()
def api_key_revoke(api_key: str) -> str:
    """API 키를 비활성화합니다 (관리자용).

    Args:
        api_key: 비활성화할 API 키
    """
    if revoke_api_key(api_key):
        return f"API 키가 비활성화되었습니다."
    return "해당 API 키를 찾을 수 없습니다."


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
