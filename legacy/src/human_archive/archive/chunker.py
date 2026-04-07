"""텍스트 청킹 모듈."""

from dataclasses import dataclass

from human_archive.archive.youtube import SubtitleSegment


@dataclass
class Chunk:
    text: str
    metadata: dict


def chunk_segments(
    segments: list[SubtitleSegment],
    video_title: str,
    video_url: str,
    max_chars: int = 800,
    overlap_chars: int = 100,
) -> list[Chunk]:
    """자막 세그먼트를 의미 단위로 청킹한다.

    인접한 세그먼트를 합쳐서 max_chars 이내의 청크로 만든다.
    청크 간 overlap_chars만큼 겹치게 하여 문맥 손실을 방지한다.
    """
    if not segments:
        return []

    # 모든 세그먼트를 (text, start_time) 쌍으로 변환
    entries = [(seg.text, seg.start) for seg in segments]

    chunks = []
    i = 0

    while i < len(entries):
        chunk_texts = []
        chunk_start = entries[i][1]
        char_count = 0

        j = i
        while j < len(entries) and char_count + len(entries[j][0]) <= max_chars:
            chunk_texts.append(entries[j][0])
            char_count += len(entries[j][0])
            j += 1

        # 최소 1개는 포함
        if not chunk_texts:
            chunk_texts.append(entries[i][0])
            j = i + 1

        chunk_end = entries[min(j - 1, len(entries) - 1)][1]

        chunks.append(Chunk(
            text=" ".join(chunk_texts),
            metadata={
                "source": "youtube",
                "video_title": video_title,
                "video_url": video_url,
                "start_time": chunk_start,
                "end_time": chunk_end,
            },
        ))

        # overlap: 뒤에서 overlap_chars만큼의 세그먼트를 포함하도록 i 조정
        if j >= len(entries):
            break

        overlap_count = 0
        back = j - 1
        while back > i and overlap_count < overlap_chars:
            overlap_count += len(entries[back][0])
            back -= 1
        i = max(back + 1, i + 1)

    return chunks
