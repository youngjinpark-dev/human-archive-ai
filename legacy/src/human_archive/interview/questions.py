"""아카이빙 인터뷰 모듈 - 전문가의 판단 프레임워크를 추출하는 구조화 인터뷰."""

import json
from dataclasses import dataclass, field

import httpx

from human_archive.config import OLLAMA_BASE, OLLAMA_MODEL
from human_archive.persona.manager import (
    DecisionScenario,
    Persona,
    add_decision_scenario,
    load_persona,
    save_persona,
    update_principles,
)


@dataclass
class InterviewPhase:
    name: str
    questions: list[str]


INTERVIEW_PHASES: list[InterviewPhase] = [
    InterviewPhase(
        name="domain",
        questions=[
            "전문 분야가 무엇인가요? 그리고 이 분야에서 몇 년 정도 경력이 있으신가요?",
            "이 분야에서 본인만의 강점이나 특기가 있다면 무엇인가요?",
        ],
    ),
    InterviewPhase(
        name="principles",
        questions=[
            "업무에서 가장 중요하게 생각하는 원칙 3가지는 무엇인가요?",
            "후배에게 꼭 강조하는 조언이 있다면 무엇인가요?",
            "이 분야에서 흔히 하는 실수는 무엇이고, 어떻게 피할 수 있나요?",
        ],
    ),
    InterviewPhase(
        name="scenarios",
        questions=[
            "가장 어려웠던 의사결정 상황은 무엇이었나요? 어떻게 판단하셨나요?",
            "예산이나 시간이 부족할 때 우선순위를 어떻게 정하시나요?",
            "고객/의뢰인의 요청이 본인의 전문적 판단과 충돌할 때 어떻게 하시나요?",
        ],
    ),
    InterviewPhase(
        name="style",
        questions=[
            "평소 설명하실 때 어떤 방식을 선호하시나요? (비유, 데이터, 사례, 직설적 등)",
        ],
    ),
]


@dataclass
class InterviewSession:
    persona_name: str
    phase_index: int = 0
    question_index: int = 0
    completed: bool = False


_sessions: dict[str, InterviewSession] = {}


def _get_session(persona_name: str, session_id: str) -> InterviewSession:
    key = f"{persona_name}_{session_id}"
    if key not in _sessions:
        _sessions[key] = InterviewSession(persona_name=persona_name)
    return _sessions[key]


def get_next_question(persona_name: str, session_id: str = "default") -> str | None:
    """다음 인터뷰 질문을 반환한다. None이면 인터뷰 완료."""
    session = _get_session(persona_name, session_id)

    if session.completed:
        return None

    if session.phase_index >= len(INTERVIEW_PHASES):
        session.completed = True
        return None

    phase = INTERVIEW_PHASES[session.phase_index]
    if session.question_index >= len(phase.questions):
        session.phase_index += 1
        session.question_index = 0
        return get_next_question(persona_name, session_id)

    return phase.questions[session.question_index]


def process_answer(persona_name: str, answer: str, session_id: str = "default") -> dict:
    """인터뷰 답변을 처리하고 페르소나에 반영한다."""
    session = _get_session(persona_name, session_id)

    if session.completed or session.phase_index >= len(INTERVIEW_PHASES):
        return {"status": "completed", "message": "인터뷰가 이미 완료되었습니다."}

    phase = INTERVIEW_PHASES[session.phase_index]
    phase_name = phase.name

    # 답변을 페르소나에 반영
    if phase_name == "domain":
        _process_domain(persona_name, answer)
    elif phase_name == "principles":
        _process_principles(persona_name, answer)
    elif phase_name == "scenarios":
        _process_scenario(persona_name, answer)
    elif phase_name == "style":
        _process_style(persona_name, answer)

    # 다음 질문으로 이동
    session.question_index += 1
    next_q = get_next_question(persona_name, session_id)

    return {
        "status": "completed" if next_q is None else "in_progress",
        "phase": phase_name,
        "saved": True,
        "next_question": next_q,
    }


def get_interview_status(persona_name: str, session_id: str = "default") -> dict:
    """인터뷰 진행 상태를 반환한다."""
    session = _get_session(persona_name, session_id)

    total_questions = sum(len(p.questions) for p in INTERVIEW_PHASES)
    answered = sum(
        len(INTERVIEW_PHASES[i].questions) for i in range(session.phase_index)
    ) + session.question_index

    current_phase = (
        INTERVIEW_PHASES[session.phase_index].name
        if session.phase_index < len(INTERVIEW_PHASES)
        else "완료"
    )

    return {
        "persona_name": persona_name,
        "current_phase": current_phase,
        "progress": f"{answered}/{total_questions}",
        "completed": session.completed,
    }


def _process_domain(persona_name: str, answer: str) -> None:
    persona = load_persona(persona_name)
    if not persona.domain:
        persona.domain = answer.strip()
    else:
        persona.domain += f" | {answer.strip()}"
    save_persona(persona)


def _process_principles(persona_name: str, answer: str) -> None:
    extracted = _extract_with_llm(
        answer,
        "이 텍스트에서 판단 원칙이나 조언을 리스트로 추출해줘. JSON 배열 형태로만 응답해. 예: [\"원칙1\", \"원칙2\"]",
    )

    if extracted:
        persona = load_persona(persona_name)
        persona.principles.extend(extracted)
        save_persona(persona)
    else:
        # fallback: 원문 그대로 저장
        persona = load_persona(persona_name)
        persona.principles.append(answer.strip())
        save_persona(persona)


def _process_scenario(persona_name: str, answer: str) -> None:
    extracted = _extract_scenario_with_llm(answer)
    if extracted:
        add_decision_scenario(persona_name, extracted)
    else:
        # fallback
        add_decision_scenario(
            persona_name,
            DecisionScenario(situation="(인터뷰 답변)", decision=answer.strip()),
        )


def _process_style(persona_name: str, answer: str) -> None:
    persona = load_persona(persona_name)
    persona.style = answer.strip()
    save_persona(persona)


def _extract_with_llm(text: str, instruction: str) -> list[str] | None:
    """LLM을 사용하여 텍스트에서 구조화된 데이터를 추출한다."""
    try:
        response = httpx.post(
            f"{OLLAMA_BASE}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": instruction},
                    {"role": "user", "content": text},
                ],
                "stream": False,
                "options": {"temperature": 0.1},
            },
            timeout=60.0,
        )
        response.raise_for_status()
        content = response.json()["message"]["content"]
        # JSON 배열 추출 시도
        start = content.find("[")
        end = content.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(content[start:end])
    except Exception:
        pass
    return None


def _extract_scenario_with_llm(text: str) -> DecisionScenario | None:
    """LLM으로 의사결정 시나리오를 추출한다."""
    try:
        response = httpx.post(
            f"{OLLAMA_BASE}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": '이 텍스트에서 의사결정 시나리오를 추출해. JSON으로만 응답해. 형식: {"situation": "상황", "decision": "판단", "reasoning": "근거"}',
                    },
                    {"role": "user", "content": text},
                ],
                "stream": False,
                "options": {"temperature": 0.1},
            },
            timeout=60.0,
        )
        response.raise_for_status()
        content = response.json()["message"]["content"]
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(content[start:end])
            return DecisionScenario(**data)
    except Exception:
        pass
    return None
