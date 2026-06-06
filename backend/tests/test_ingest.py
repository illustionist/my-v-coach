from pathlib import Path

import soundfile as sf

from app.services.ingest import ingest_song
from app.services.isolation import StubIsolator


def test_ingest_produces_song_with_pitch_curve(tmp_path, tmp_library, sine_440, sr):
    src = tmp_path / "song.wav"
    sf.write(src, sine_440, sr)

    summary = ingest_song(
        source_path=src,
        title="A4 Tone",
        library=tmp_library,
        isolator=StubIsolator(),
        hop_sec=0.01,
    )

    assert summary.title == "A4 Tone"
    assert summary.duration_sec > 0.9

    detail = tmp_library.get_song(summary.id)
    voiced = [f.hz for f in detail.curve.frames if f.hz > 0]
    assert voiced  # the stub feeds the tone through as the vocal
    assert abs(sum(voiced) / len(voiced) - 440.0) < 15.0
