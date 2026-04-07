"""YouTube 자막 추출 모듈."""

import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass
class SubtitleSegment:
    start: float
    end: float
    text: str


@dataclass
class VideoInfo:
    title: str
    url: str
    channel: str
    duration: float
    segments: list[SubtitleSegment]

    @property
    def full_text(self) -> str:
        return "\n".join(seg.text for seg in self.segments)


def extract_subtitles(url: str) -> VideoInfo:
    """YouTube URL에서 자막을 추출한다.

    한국어 자막 우선, 없으면 자동생성 자막, 그것도 없으면 영어 자막 순서로 시도.
    """
    # 영상 메타데이터 가져오기
    meta = _get_video_info(url)

    # 자막 추출 시도 (한국어 > 자동생성 한국어 > 영어 > 자동생성 영어)
    segments = _try_extract_subtitles(url)

    return VideoInfo(
        title=meta.get("title", "Unknown"),
        url=url,
        channel=meta.get("channel", "Unknown"),
        duration=meta.get("duration", 0),
        segments=segments,
    )


def _get_video_info(url: str) -> dict:
    """yt-dlp로 영상 메타데이터를 가져온다."""
    result = subprocess.run(
        [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-warnings",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(f"영상 정보를 가져올 수 없습니다: {result.stderr}")
    return json.loads(result.stdout)


def _try_extract_subtitles(url: str) -> list[SubtitleSegment]:
    """자막 추출을 여러 방법으로 시도한다."""
    # 방법 1: 수동 자막 (한국어 → 영어)
    for lang in ["ko", "en"]:
        segments = _extract_sub(url, lang, auto=False)
        if segments:
            return segments

    # 방법 2: 자동생성 자막 (한국어 → 영어)
    for lang in ["ko", "en"]:
        segments = _extract_sub(url, lang, auto=True)
        if segments:
            return segments

    raise RuntimeError("자막을 찾을 수 없습니다. 자막이 있는 영상을 사용해주세요.")


def _extract_sub(url: str, lang: str, auto: bool) -> list[SubtitleSegment]:
    """특정 언어의 자막을 JSON 형식으로 추출한다."""
    with tempfile.TemporaryDirectory() as tmpdir:
        out_path = Path(tmpdir) / "sub"
        sub_flag = "--write-auto-sub" if auto else "--write-sub"

        subprocess.run(
            [
                "yt-dlp",
                sub_flag,
                "--sub-lang", lang,
                "--sub-format", "json3",
                "--skip-download",
                "--no-warnings",
                "-o", str(out_path),
                url,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        # json3 파일 찾기
        json_files = list(Path(tmpdir).glob("*.json3"))
        if not json_files:
            return []

        return _parse_json3(json_files[0])


def _parse_json3(path: Path) -> list[SubtitleSegment]:
    """json3 자막 파일을 파싱한다."""
    data = json.loads(path.read_text(encoding="utf-8"))
    events = data.get("events", [])

    segments = []
    for event in events:
        segs = event.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text or text == "\n":
            continue

        start_ms = event.get("tStartMs", 0)
        duration_ms = event.get("dDurationMs", 0)

        segments.append(SubtitleSegment(
            start=start_ms / 1000,
            end=(start_ms + duration_ms) / 1000,
            text=text,
        ))

    return segments
