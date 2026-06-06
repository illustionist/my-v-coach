import io
from pathlib import Path

import soundfile as sf

from app.models.schemas import PitchCurve, SongSummary
from app.services.isolation import Isolator, StemSet
from app.services.library import Library
from app.services.pitch import analyze_pitch


def _to_wav_bytes(audio, sr: int) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    return buf.getvalue()


def ingest_song(
    *,
    source_path: Path,
    title: str,
    library: Library,
    isolator: Isolator,
    hop_sec: float = 0.01,
) -> SongSummary:
    stems: StemSet = isolator.separate(source_path)
    duration_sec = len(stems.vocal) / float(stems.sr)

    frames = analyze_pitch(stems.vocal, stems.sr, hop_sec=hop_sec)
    curve = PitchCurve(
        song_id="pending",
        title=title,
        duration_sec=round(duration_sec, 3),
        hop_sec=hop_sec,
        frames=frames,
    )

    return library.add_song(
        title=title,
        duration_sec=round(duration_sec, 3),
        hop_sec=hop_sec,
        vocal_bytes=_to_wav_bytes(stems.vocal, stems.sr),
        instrumental_bytes=_to_wav_bytes(stems.instrumental, stems.sr),
        curve=curve,
    )
