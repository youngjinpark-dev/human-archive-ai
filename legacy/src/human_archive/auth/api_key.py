"""API 키 인증 모듈."""

import secrets
from datetime import datetime

import yaml

from human_archive.config import API_KEYS_FILE


def generate_api_key() -> str:
    """ha_ 접두사 + 32자 hex 키를 생성한다."""
    return f"ha_{secrets.token_hex(16)}"


def _load_keys() -> dict:
    """API 키 파일을 로드한다."""
    if not API_KEYS_FILE.exists():
        return {"keys": {}}
    data = yaml.safe_load(API_KEYS_FILE.read_text(encoding="utf-8"))
    return data or {"keys": {}}


def _save_keys(data: dict) -> None:
    """API 키 파일을 저장한다."""
    API_KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
    API_KEYS_FILE.write_text(
        yaml.dump(data, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )


def create_api_key(owner: str, allowed_personas: list[str] | None = None) -> str:
    """새 API 키를 생성하고 저장한다."""
    key = generate_api_key()
    data = _load_keys()
    data["keys"][key] = {
        "owner": owner,
        "allowed_personas": allowed_personas,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "active": True,
    }
    _save_keys(data)
    return key


def validate_api_key(key: str, persona_name: str | None = None) -> dict | None:
    """API 키를 검증한다. 유효하면 키 정보를, 아니면 None을 반환."""
    data = _load_keys()
    key_info = data.get("keys", {}).get(key)

    if not key_info or not key_info.get("active", False):
        return None

    # 페르소나 접근 권한 확인
    allowed = key_info.get("allowed_personas")
    if persona_name and allowed and persona_name not in allowed:
        return None

    return key_info


def revoke_api_key(key: str) -> bool:
    """API 키를 비활성화한다."""
    data = _load_keys()
    if key not in data.get("keys", {}):
        return False
    data["keys"][key]["active"] = False
    _save_keys(data)
    return True
