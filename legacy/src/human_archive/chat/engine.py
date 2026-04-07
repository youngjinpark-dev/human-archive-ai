"""RAG + Ollama 대화 엔진."""

from dataclasses import dataclass, field

import httpx

from human_archive.chat.retriever import format_context, search
from human_archive.config import OLLAMA_BASE, OLLAMA_MODEL
from human_archive.persona.manager import load_persona
from human_archive.persona.prompt import build_system_prompt


@dataclass
class Message:
    role: str  # "user" or "assistant"
    content: str


@dataclass
class ChatSession:
    persona_name: str
    history: list[Message] = field(default_factory=list)


# 세션 저장소 (메모리 기반)
_sessions: dict[str, ChatSession] = {}


def chat(persona_name: str, user_message: str, session_id: str | None = None, model: str = OLLAMA_MODEL) -> str:
    """페르소나와 대화한다.

    1. 사용자 질문으로 벡터 검색
    2. 시스템 프롬프트 구성
    3. Ollama LLM 호출
    4. 응답 반환
    """
    # 페르소나 로드
    persona = load_persona(persona_name)

    # 세션 관리
    sid = session_id or f"{persona_name}_default"
    if sid not in _sessions:
        _sessions[sid] = ChatSession(persona_name=persona_name)
    session = _sessions[sid]

    # RAG: 관련 컨텍스트 검색
    results = search(persona_name, user_message, top_k=5)
    context = format_context(results)

    # 시스템 프롬프트 생성
    system_prompt = build_system_prompt(persona, context)

    # 대화 히스토리 구성 (최근 10개까지)
    recent_history = session.history[-10:]
    messages = [{"role": m.role, "content": m.content} for m in recent_history]
    messages.append({"role": "user", "content": user_message})

    # Ollama 호출
    response = _call_ollama(model, system_prompt, messages)

    # 히스토리 업데이트
    session.history.append(Message(role="user", content=user_message))
    session.history.append(Message(role="assistant", content=response))

    return response


def _call_ollama(model: str, system: str, messages: list[dict]) -> str:
    """Ollama API를 호출하여 응답을 생성한다."""
    response = httpx.post(
        f"{OLLAMA_BASE}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                *messages,
            ],
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "num_predict": 1024,
            },
        },
        timeout=120.0,
    )
    response.raise_for_status()
    return response.json()["message"]["content"]
