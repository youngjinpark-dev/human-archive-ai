"""페르소나 관리 모듈."""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import yaml

from human_archive.config import PERSONAS_DIR


@dataclass
class Source:
    type: str
    url: str
    title: str = ""
    archived_at: str = ""


@dataclass
class DecisionScenario:
    situation: str
    decision: str
    reasoning: str = ""


@dataclass
class Persona:
    name: str
    description: str
    style: str
    domain: str = ""
    sources: list[Source] = field(default_factory=list)
    principles: list[str] = field(default_factory=list)
    decision_scenarios: list[DecisionScenario] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "style": self.style,
            "domain": self.domain,
            "sources": [
                {"type": s.type, "url": s.url, "title": s.title, "archived_at": s.archived_at}
                for s in self.sources
            ],
            "principles": self.principles,
            "decision_scenarios": [
                {"situation": ds.situation, "decision": ds.decision, "reasoning": ds.reasoning}
                for ds in self.decision_scenarios
            ],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Persona":
        sources = [Source(**s) for s in data.get("sources", [])]
        scenarios = [DecisionScenario(**ds) for ds in data.get("decision_scenarios", [])]
        return cls(
            name=data["name"],
            description=data["description"],
            style=data.get("style", ""),
            domain=data.get("domain", ""),
            sources=sources,
            principles=data.get("principles", []),
            decision_scenarios=scenarios,
        )


def save_persona(persona: Persona) -> Path:
    """페르소나를 YAML 파일로 저장한다."""
    PERSONAS_DIR.mkdir(parents=True, exist_ok=True)
    path = PERSONAS_DIR / f"{_safe_filename(persona.name)}.yaml"
    path.write_text(yaml.dump(persona.to_dict(), allow_unicode=True, default_flow_style=False), encoding="utf-8")
    return path


def load_persona(name: str) -> Persona:
    """이름으로 페르소나를 로드한다."""
    path = PERSONAS_DIR / f"{_safe_filename(name)}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"페르소나 '{name}'을 찾을 수 없습니다.")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return Persona.from_dict(data)


def list_personas() -> list[Persona]:
    """등록된 모든 페르소나를 반환한다."""
    if not PERSONAS_DIR.exists():
        return []
    personas = []
    for path in PERSONAS_DIR.glob("*.yaml"):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        personas.append(Persona.from_dict(data))
    return personas


def delete_persona(name: str) -> bool:
    """페르소나를 삭제한다."""
    path = PERSONAS_DIR / f"{_safe_filename(name)}.yaml"
    if path.exists():
        path.unlink()
        return True
    return False


def add_source_to_persona(name: str, source: Source) -> Persona:
    """기존 페르소나에 소스를 추가한다."""
    persona = load_persona(name)
    source.archived_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    persona.sources.append(source)
    save_persona(persona)
    return persona


def update_principles(name: str, principles: list[str]) -> Persona:
    """페르소나의 판단 원칙을 업데이트한다."""
    persona = load_persona(name)
    persona.principles = principles
    save_persona(persona)
    return persona


def add_decision_scenario(name: str, scenario: DecisionScenario) -> Persona:
    """페르소나에 의사결정 시나리오를 추가한다."""
    persona = load_persona(name)
    persona.decision_scenarios.append(scenario)
    save_persona(persona)
    return persona


def _safe_filename(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in name).strip()
