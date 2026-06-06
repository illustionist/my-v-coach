import numpy as np

from app.services.pitch import analyze_pitch


def test_detects_a4_from_sine(sine_440, sr):
    frames = analyze_pitch(sine_440, sr, hop_sec=0.01)
    voiced = [f.hz for f in frames if f.hz > 0]
    assert len(voiced) > 0
    median_hz = float(np.median(voiced))
    assert abs(median_hz - 440.0) < 10.0  # within ~40 cents


def test_silence_yields_zero_pitch(silence, sr):
    frames = analyze_pitch(silence, sr, hop_sec=0.01)
    assert all(f.hz == 0.0 for f in frames)
    assert all(f.conf == 0.0 for f in frames)


def test_frame_timestamps_are_monotonic(sine_440, sr):
    frames = analyze_pitch(sine_440, sr, hop_sec=0.01)
    times = [f.t for f in frames]
    assert times == sorted(times)
    assert len(times) == len(set(times))
