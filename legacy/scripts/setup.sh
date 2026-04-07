#!/bin/bash
set -e

echo "=== Human Archive AI - Setup ==="

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo ""
    echo "Ollama가 설치되어 있지 않습니다."
    echo "설치: https://ollama.com/download"
    echo "  또는: brew install ollama"
    exit 1
fi

echo "Ollama 확인됨: $(ollama --version)"

# Pull required models
echo ""
echo "=== LLM 모델 다운로드 ==="
echo "gemma2:9b 다운로드 중... (약 5.4GB)"
ollama pull gemma2:9b

echo ""
echo "=== 임베딩 모델 다운로드 ==="
echo "nomic-embed-text 다운로드 중... (약 274MB)"
ollama pull nomic-embed-text

echo ""
echo "=== Python 의존성 설치 ==="
uv sync

echo ""
echo "=== 셋업 완료 ==="
echo "사용법:"
echo "  1. Ollama 실행: ollama serve"
echo "  2. Claude Code에서 MCP 서버로 등록하여 사용"
