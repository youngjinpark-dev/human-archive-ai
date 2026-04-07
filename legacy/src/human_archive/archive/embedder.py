"""임베딩 + ChromaDB 저장 모듈."""

import chromadb
import httpx

from human_archive.archive.chunker import Chunk
from human_archive.config import CHROMA_PATH, EMBED_MODEL, OLLAMA_BASE


def get_chroma_client() -> chromadb.ClientAPI:
    """ChromaDB 클라이언트를 반환한다."""
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(CHROMA_PATH))


def get_collection(persona_name: str) -> chromadb.Collection:
    """페르소나별 ChromaDB 컬렉션을 가져오거나 생성한다."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=_sanitize_name(persona_name),
        metadata={"hnsw:space": "cosine"},
    )


def embed_text(text: str) -> list[float]:
    """Ollama를 사용하여 텍스트를 임베딩한다."""
    response = httpx.post(
        f"{OLLAMA_BASE}/api/embed",
        json={"model": EMBED_MODEL, "input": text},
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()
    return data["embeddings"][0]


def embed_chunks(persona_name: str, chunks: list[Chunk]) -> int:
    """청크 목록을 임베딩하여 ChromaDB에 저장한다. 저장된 청크 수를 반환."""
    if not chunks:
        return 0

    collection = get_collection(persona_name)
    existing = collection.count()

    ids = []
    documents = []
    metadatas = []
    embeddings = []

    for i, chunk in enumerate(chunks):
        chunk_id = f"{persona_name}_{existing + i}"
        ids.append(chunk_id)
        documents.append(chunk.text)
        metadatas.append(chunk.metadata)
        embeddings.append(embed_text(chunk.text))

    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings,
    )

    return len(chunks)


def _sanitize_name(name: str) -> str:
    """ChromaDB 컬렉션 이름 규칙에 맞게 변환."""
    sanitized = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    # 최소 3자, 최대 63자
    if len(sanitized) < 3:
        sanitized = sanitized + "_" * (3 - len(sanitized))
    return sanitized[:63]
