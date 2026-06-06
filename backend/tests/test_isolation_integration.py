from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.services.isolation import StubIsolator


def test_stub_isolator_returns_input_as_vocal(tmp_path: Path, sr: int, sine_440):
    wav_path = tmp_path / "in.wav"
    sf.write(wav_path, sine_440, sr)
    stems = StubIsolator().separate(wav_path)
    assert stems.sr == sr
    assert np.allclose(stems.vocal, sine_440, atol=1e-3)
    assert np.all(stems.instrumental == 0.0)


@pytest.mark.slow
def test_demucs_isolator_separates_real_clip():
    """Opt-in: requires demucs model weights (downloaded on first run).

    Run with: python -m pytest -m slow tests/test_isolation_integration.py -v
    Provide a short stereo clip at tests/fixtures/clip.wav before running.
    """
    from app.services.isolation import DemucsIsolator

    clip = Path(__file__).parent / "fixtures" / "clip.wav"
    if not clip.exists():
        pytest.skip("tests/fixtures/clip.wav not present")
    stems = DemucsIsolator().separate(clip)
    assert stems.vocal.shape == stems.instrumental.shape
    assert stems.sr > 0
