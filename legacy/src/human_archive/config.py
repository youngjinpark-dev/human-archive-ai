"""환경변수 기반 설정."""

import os
from pathlib import Path

# Ollama 서버 주소 (원격 서버 사용 시 변경)
# 예: OLLAMA_BASE=http://192.168.0.10:11434
OLLAMA_BASE = os.environ.get("OLLAMA_BASE", "http://localhost:11434")

# LLM 모델명
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma2:9b")

# 임베딩 모델명
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")

# 데이터 저장 경로
DATA_DIR = Path(os.environ.get("HUMAN_ARCHIVE_DATA", str(Path(__file__).parent.parent.parent / "data")))
CHROMA_PATH = DATA_DIR / "chroma"
PERSONAS_DIR = DATA_DIR / "personas"

# 인증
AUTH_ENABLED = os.environ.get("HUMAN_ARCHIVE_AUTH", "false").lower() == "true"
API_KEYS_FILE = DATA_DIR / "api_keys.yaml"
