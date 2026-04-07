"""벡터 검색 모듈."""

from dataclasses import dataclass

from human_archive.archive.embedder import embed_text, get_collection


@dataclass
class SearchResult:
    text: str
    metadata: dict
    distance: float


def search(persona_name: str, query: str, top_k: int = 5) -> list[SearchResult]:
    """페르소나의 아카이브에서 질문과 관련된 청크를 검색한다."""
    collection = get_collection(persona_name)

    if collection.count() == 0:
        return []

    query_embedding = embed_text(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
    )

    search_results = []
    for i in range(len(results["ids"][0])):
        search_results.append(SearchResult(
            text=results["documents"][0][i],
            metadata=results["metadatas"][0][i],
            distance=results["distances"][0][i] if results.get("distances") else 0.0,
        ))

    return search_results


def format_context(results: list[SearchResult]) -> str:
    """검색 결과를 LLM 컨텍스트 문자열로 포맷팅한다."""
    if not results:
        return "(관련 자료 없음)"

    parts = []
    for i, r in enumerate(results, 1):
        source_info = ""
        if r.metadata.get("video_title"):
            source_info = f" (출처: {r.metadata['video_title']})"
        parts.append(f"[{i}]{source_info}\n{r.text}")

    return "\n\n".join(parts)
