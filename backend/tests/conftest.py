from pathlib import Path

import numpy as np
import pytest

from app.services.library import Library


@pytest.fixture
def sr() -> int:
    return 22050


@pytest.fixture
def sine_440(sr: int) -> np.ndarray:
    """1 second of a 440 Hz (A4) sine wave."""
    t = np.linspace(0.0, 1.0, sr, endpoint=False)
    return (0.5 * np.sin(2 * np.pi * 440.0 * t)).astype(np.float32)


@pytest.fixture
def silence(sr: int) -> np.ndarray:
    """0.5 seconds of silence."""
    return np.zeros(sr // 2, dtype=np.float32)


@pytest.fixture
def tmp_library(tmp_path: Path) -> Library:
    return Library(storage_dir=tmp_path)
