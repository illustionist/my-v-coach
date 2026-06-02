# Vocal Trainer Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local Python backend that ingests an MP3, isolates the vocal, analyzes its pitch, and serves stems + a pitch curve over a small HTTP API.

**Architecture:** FastAPI app with three injectable services — `isolation` (Demucs → vocal + instrumental stems), `pitch` (librosa pYIN → reference pitch curve), and `library` (SQLite index + on-disk files). An `ingest` pipeline composes them. The heavy/slow service (isolation) sits behind a small protocol so the API and pipeline can be tested with a fake, and the real Demucs run is an opt-in integration test.

**Tech Stack:** Python 3.11, FastAPI, uvicorn, Pydantic v2, librosa + numpy + soundfile (pitch + audio I/O), Demucs (isolation), pytest.

---

## File Structure

```
my-v-coach/
  backend/
    pyproject.toml                 # project + deps
    .gitignore                     # venv, __pycache__, storage/
    app/
      __init__.py
      main.py                      # FastAPI app factory + router wiring
      core/
        __init__.py
        config.py                  # Settings: storage dir, pitch params
      models/
        __init__.py
        schemas.py                 # Pydantic: PitchFrame, PitchCurve, SongSummary, SongDetail
      services/
        __init__.py
        pitch.py                   # analyze_pitch(audio, sr, hop_sec) -> PitchCurve frames
        library.py                 # Library: SQLite + filesystem store
        isolation.py               # Isolator protocol + DemucsIsolator + StubIsolator
        ingest.py                  # ingest_song() composes isolation + pitch + library
      api/
        __init__.py
        songs.py                   # POST /songs, GET /songs, GET /songs/{id}, stem download
    tests/
      __init__.py
      conftest.py                  # tmp storage, sine-wave + silent-wav fixtures
      test_pitch.py
      test_library.py
      test_ingest.py
      test_api.py
      test_isolation_integration.py # @pytest.mark.slow real Demucs run
```

**Responsibilities:**
- `pitch.py` — pure DSP: numpy audio in, pitch frames out. No I/O. Easiest to test hard.
- `library.py` — all persistence (SQLite + files). Knows nothing about audio analysis.
- `isolation.py` — the slow ML wrapper, behind an `Isolator` protocol so tests use `StubIsolator`.
- `ingest.py` — orchestration only: decode → isolate → analyze → store. No DSP or SQL of its own.
- `api/songs.py` — HTTP only; depends on injected `Library` + `Isolator` so tests swap fakes.

---

## Task 1: Project scaffold + booting FastAPI app

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.gitignore`
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/app/core/__init__.py` (empty)
- Create: `backend/app/core/config.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py` (empty)
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "my-v-coach-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "pydantic>=2.6",
    "python-multipart>=0.0.9",
    "numpy>=1.26",
    "soundfile>=0.12",
    "librosa>=0.10",
    "demucs>=4.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27"]

[tool.pytest.ini_options]
markers = ["slow: real ML/integration tests (deselect with '-m \"not slow\"')"]
addopts = "-m 'not slow'"
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
.venv/
__pycache__/
*.pyc
storage/
.pytest_cache/
```

- [ ] **Step 3: Create the empty package files**

Create `backend/app/__init__.py`, `backend/app/core/__init__.py`, and `backend/tests/__init__.py` as empty files.

- [ ] **Step 4: Create `app/core/config.py`**

```python
from pathlib import Path
from functools import lru_cache


class Settings:
    """Runtime configuration. Storage dir is overridable for tests."""

    def __init__(self, storage_dir: Path | None = None) -> None:
        self.storage_dir = storage_dir or (Path(__file__).resolve().parents[2] / "storage")
        self.hop_sec: float = 0.01
        self.fmin_note: str = "C2"
        self.fmax_note: str = "C7"

    def ensure_dirs(self) -> None:
        self.storage_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
```

- [ ] **Step 5: Write the failing test for the health endpoint**

Create `backend/tests/test_api.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok():
    client = TestClient(create_app())
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 6: Run the test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_api.py::test_health_returns_ok -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 7: Create `app/main.py` with the health route**

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="my-v-coach backend")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `python -m pytest tests/test_api.py::test_health_returns_ok -v`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat(backend): scaffold FastAPI app with health endpoint"
```

---

## Task 2: Pydantic schemas (the data contract)

**Files:**
- Create: `backend/app/models/__init__.py` (empty)
- Create: `backend/app/models/schemas.py`
- Create: `backend/tests/test_schemas.py`

- [ ] **Step 1: Create empty `app/models/__init__.py`**

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_schemas.py`:

```python
from app.models.schemas import PitchFrame, PitchCurve, SongSummary


def test_pitch_curve_serializes_with_camelcase_keys():
    curve = PitchCurve(
        song_id="abc123",
        title="Song Name",
        duration_sec=2.0,
        hop_sec=0.01,
        frames=[PitchFrame(t=0.5, hz=220.0, conf=0.93)],
    )
    data = curve.model_dump(by_alias=True)
    assert data["songId"] == "abc123"
    assert data["durationSec"] == 2.0
    assert data["hopSec"] == 0.01
    assert data["frames"][0] == {"t": 0.5, "hz": 220.0, "conf": 0.93}


def test_song_summary_round_trips():
    s = SongSummary(id="abc123", title="Song Name", duration_sec=212.4)
    data = s.model_dump(by_alias=True)
    assert data == {"id": "abc123", "title": "Song Name", "durationSec": 212.4}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `python -m pytest tests/test_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.schemas'`.

- [ ] **Step 4: Create `app/models/schemas.py`**

The frontend consumes camelCase JSON (see spec §6), but Python code uses snake_case. Pydantic aliases bridge the two.

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PitchFrame(BaseModel):
    t: float
    hz: float
    conf: float


class PitchCurve(CamelModel):
    song_id: str
    title: str
    duration_sec: float
    hop_sec: float
    frames: list[PitchFrame]


class SongSummary(CamelModel):
    id: str
    title: str
    duration_sec: float


class SongDetail(CamelModel):
    id: str
    title: str
    duration_sec: float
    hop_sec: float
    vocal_url: str
    instrumental_url: str
    curve: PitchCurve
```

Note: `PitchFrame` is intentionally not camelized — its keys (`t`, `hz`, `conf`) are already short and identical in both worlds, and there are thousands per song.

- [ ] **Step 5: Run the test to verify it passes**

Run: `python -m pytest tests/test_schemas.py -v`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add backend/app/models backend/tests/test_schemas.py
git commit -m "feat(backend): add pitch-curve and song schemas"
```

---

## Task 3: Pitch analysis service

**Files:**
- Create: `backend/app/services/__init__.py` (empty)
- Create: `backend/app/services/pitch.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_pitch.py`

- [ ] **Step 1: Create empty `app/services/__init__.py`**

- [ ] **Step 2: Create `tests/conftest.py` with audio fixtures**

```python
import numpy as np
import pytest


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
```

- [ ] **Step 3: Write the failing tests**

Create `backend/tests/test_pitch.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `python -m pytest tests/test_pitch.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.pitch'`.

- [ ] **Step 5: Create `app/services/pitch.py`**

```python
import librosa
import numpy as np

from app.models.schemas import PitchFrame


def analyze_pitch(audio: np.ndarray, sr: int, hop_sec: float = 0.01) -> list[PitchFrame]:
    """Estimate the fundamental frequency over time using probabilistic YIN.

    Returns one frame per hop. `hz == 0.0` marks unvoiced/silent frames.
    """
    hop_length = max(1, int(round(sr * hop_sec)))
    f0, _voiced_flag, voiced_prob = librosa.pyin(
        audio,
        sr=sr,
        fmin=float(librosa.note_to_hz("C2")),
        fmax=float(librosa.note_to_hz("C7")),
        hop_length=hop_length,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)

    frames: list[PitchFrame] = []
    for t, hz, prob in zip(times, f0, voiced_prob):
        voiced = hz is not None and not np.isnan(hz)
        hz_val = float(hz) if voiced else 0.0
        conf = float(prob) if (prob is not None and not np.isnan(prob)) else 0.0
        frames.append(
            PitchFrame(
                t=round(float(t), 3),
                hz=round(hz_val, 2),
                conf=round(conf if voiced else 0.0, 2),
            )
        )
    return frames
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_pitch.py -v`
Expected: PASS (all three). First run downloads nothing for librosa; it may be slow (~seconds) but no network needed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services backend/tests/conftest.py backend/tests/test_pitch.py
git commit -m "feat(backend): add pYIN pitch analysis service"
```

---

## Task 4: Library store (SQLite + filesystem)

**Files:**
- Create: `backend/app/services/library.py`
- Create: `backend/tests/test_library.py`
- Modify: `backend/tests/conftest.py` (add `tmp_library` fixture)

- [ ] **Step 1: Add a `tmp_library` fixture to `tests/conftest.py`**

Append to `backend/tests/conftest.py`:

```python
from pathlib import Path

from app.services.library import Library


@pytest.fixture
def tmp_library(tmp_path: Path) -> Library:
    return Library(storage_dir=tmp_path)
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_library.py`:

```python
from app.models.schemas import PitchCurve, PitchFrame


def _curve(song_id: str) -> PitchCurve:
    return PitchCurve(
        song_id=song_id,
        title="T",
        duration_sec=1.0,
        hop_sec=0.01,
        frames=[PitchFrame(t=0.0, hz=440.0, conf=0.9)],
    )


def test_add_then_get_round_trips(tmp_library):
    record = tmp_library.add_song(
        title="My Song",
        duration_sec=1.0,
        hop_sec=0.01,
        vocal_bytes=b"VOCAL",
        instrumental_bytes=b"INSTR",
        curve=_curve("placeholder"),
    )
    fetched = tmp_library.get_song(record.id)
    assert fetched is not None
    assert fetched.title == "My Song"
    assert fetched.duration_sec == 1.0
    # curve.song_id is rewritten to the real id on store
    assert fetched.curve.song_id == record.id
    assert fetched.curve.frames[0].hz == 440.0


def test_stem_bytes_are_persisted(tmp_library):
    record = tmp_library.add_song(
        title="My Song", duration_sec=1.0, hop_sec=0.01,
        vocal_bytes=b"VOCAL", instrumental_bytes=b"INSTR", curve=_curve("x"),
    )
    assert tmp_library.read_stem(record.id, "vocal") == b"VOCAL"
    assert tmp_library.read_stem(record.id, "instrumental") == b"INSTR"


def test_list_returns_summaries(tmp_library):
    tmp_library.add_song(title="A", duration_sec=1.0, hop_sec=0.01,
                         vocal_bytes=b"v", instrumental_bytes=b"i", curve=_curve("x"))
    tmp_library.add_song(title="B", duration_sec=2.0, hop_sec=0.01,
                         vocal_bytes=b"v", instrumental_bytes=b"i", curve=_curve("y"))
    summaries = tmp_library.list_songs()
    titles = sorted(s.title for s in summaries)
    assert titles == ["A", "B"]


def test_get_missing_song_returns_none(tmp_library):
    assert tmp_library.get_song("does-not-exist") is None


def test_read_stem_rejects_unknown_kind(tmp_library):
    record = tmp_library.add_song(title="A", duration_sec=1.0, hop_sec=0.01,
                                  vocal_bytes=b"v", instrumental_bytes=b"i", curve=_curve("x"))
    import pytest
    with pytest.raises(ValueError):
        tmp_library.read_stem(record.id, "drums")
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `python -m pytest tests/test_library.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.library'`.

- [ ] **Step 4: Create `app/services/library.py`**

```python
import json
import sqlite3
import uuid
from pathlib import Path

from app.models.schemas import PitchCurve, SongDetail, SongSummary

_STEM_KINDS = ("vocal", "instrumental")


class Library:
    """Persists songs as SQLite rows plus on-disk stem + curve files."""

    def __init__(self, storage_dir: Path) -> None:
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.storage_dir / "library.db"
        self._init_db()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS songs (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    duration_sec REAL NOT NULL,
                    hop_sec REAL NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _song_dir(self, song_id: str) -> Path:
        d = self.storage_dir / "songs" / song_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def add_song(
        self,
        *,
        title: str,
        duration_sec: float,
        hop_sec: float,
        vocal_bytes: bytes,
        instrumental_bytes: bytes,
        curve: PitchCurve,
    ) -> SongSummary:
        song_id = uuid.uuid4().hex
        song_dir = self._song_dir(song_id)
        (song_dir / "vocal.wav").write_bytes(vocal_bytes)
        (song_dir / "instrumental.wav").write_bytes(instrumental_bytes)

        stored_curve = curve.model_copy(update={"song_id": song_id})
        (song_dir / "curve.json").write_text(
            json.dumps(stored_curve.model_dump(by_alias=True)), encoding="utf-8"
        )

        with self._connect() as conn:
            conn.execute(
                "INSERT INTO songs (id, title, duration_sec, hop_sec) VALUES (?, ?, ?, ?)",
                (song_id, title, duration_sec, hop_sec),
            )
        return SongSummary(id=song_id, title=title, duration_sec=duration_sec)

    def list_songs(self) -> list[SongSummary]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, title, duration_sec FROM songs ORDER BY created_at DESC"
            ).fetchall()
        return [
            SongSummary(id=r["id"], title=r["title"], duration_sec=r["duration_sec"])
            for r in rows
        ]

    def get_song(self, song_id: str) -> SongDetail | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, title, duration_sec, hop_sec FROM songs WHERE id = ?",
                (song_id,),
            ).fetchone()
        if row is None:
            return None
        curve_path = self._song_dir(song_id) / "curve.json"
        curve = PitchCurve.model_validate_json(curve_path.read_text(encoding="utf-8"))
        return SongDetail(
            id=row["id"],
            title=row["title"],
            duration_sec=row["duration_sec"],
            hop_sec=row["hop_sec"],
            vocal_url=f"/songs/{song_id}/stems/vocal",
            instrumental_url=f"/songs/{song_id}/stems/instrumental",
            curve=curve,
        )

    def read_stem(self, song_id: str, kind: str) -> bytes:
        if kind not in _STEM_KINDS:
            raise ValueError(f"unknown stem kind: {kind!r}")
        return (self._song_dir(song_id) / f"{kind}.wav").read_bytes()
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python -m pytest tests/test_library.py -v`
Expected: PASS (all five).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/library.py backend/tests/test_library.py backend/tests/conftest.py
git commit -m "feat(backend): add SQLite + filesystem library store"
```

---

## Task 5: Isolation service (protocol + stub + real Demucs)

**Files:**
- Create: `backend/app/services/isolation.py`
- Create: `backend/tests/test_isolation_integration.py`

- [ ] **Step 1: Create `app/services/isolation.py`**

The protocol is the seam. `StubIsolator` is what every fast test uses; `DemucsIsolator` is exercised only by the slow integration test and at runtime.

```python
from pathlib import Path
from typing import Protocol

import numpy as np
import soundfile as sf


class StemSet:
    """Result of isolation: two mono/stereo float arrays at a common sample rate."""

    def __init__(self, vocal: np.ndarray, instrumental: np.ndarray, sr: int) -> None:
        self.vocal = vocal
        self.instrumental = instrumental
        self.sr = sr


class Isolator(Protocol):
    def separate(self, audio_path: Path) -> StemSet:
        """Split an audio file into vocal + instrumental stems."""
        ...


class StubIsolator:
    """Test double: 'vocal' is the input as-is, 'instrumental' is silence."""

    def separate(self, audio_path: Path) -> StemSet:
        audio, sr = sf.read(audio_path, dtype="float32", always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return StemSet(vocal=audio, instrumental=np.zeros_like(audio), sr=sr)


class DemucsIsolator:
    """Real separation via Demucs (htdemucs). Heavy: loads a model, uses CPU/GPU."""

    def __init__(self, model_name: str = "htdemucs") -> None:
        self.model_name = model_name

    def separate(self, audio_path: Path) -> StemSet:
        import torch
        from demucs.apply import apply_model
        from demucs.audio import AudioFile, convert_audio
        from demucs.pretrained import get_model

        model = get_model(self.model_name)
        model.eval()
        wav = AudioFile(audio_path).read(
            streams=0, samplerate=model.samplerate, channels=model.audio_channels
        )
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / (ref.std() + 1e-8)
        with torch.no_grad():
            sources = apply_model(model, wav[None], device="cpu")[0]
        sources = sources * ref.std() + ref.mean()

        stems = dict(zip(model.sources, sources))
        vocal = stems["vocals"].mean(0).cpu().numpy()
        others = sum(stems[s] for s in model.sources if s != "vocals")
        instrumental = others.mean(0).cpu().numpy()
        return StemSet(vocal=vocal, instrumental=instrumental, sr=model.samplerate)
```

- [ ] **Step 2: Write the (fast) unit test for the stub**

Append to a new file `backend/tests/test_isolation_integration.py`:

```python
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
```

- [ ] **Step 3: Run the fast test to verify it passes**

Run: `python -m pytest tests/test_isolation_integration.py::test_stub_isolator_returns_input_as_vocal -v`
Expected: PASS. (The `slow`-marked test is deselected by default via `addopts`.)

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/isolation.py backend/tests/test_isolation_integration.py
git commit -m "feat(backend): add isolation protocol, stub, and Demucs implementation"
```

---

## Task 6: Ingest pipeline

**Files:**
- Create: `backend/app/services/ingest.py`
- Create: `backend/tests/test_ingest.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_ingest.py`:

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_ingest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ingest'`.

- [ ] **Step 3: Create `app/services/ingest.py`**

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_ingest.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ingest.py backend/tests/test_ingest.py
git commit -m "feat(backend): add ingest pipeline composing isolation + pitch + library"
```

---

## Task 7: API endpoints

**Files:**
- Create: `backend/app/api/__init__.py` (empty)
- Create: `backend/app/api/songs.py`
- Modify: `backend/app/main.py` (wire router + dependency overrides)
- Modify: `backend/tests/test_api.py` (add endpoint tests)

- [ ] **Step 1: Create empty `app/api/__init__.py`**

- [ ] **Step 2: Create `app/api/songs.py`**

The router depends on `get_library` and `get_isolator`. Tests override these via FastAPI's `dependency_overrides` to inject a temp `Library` and a `StubIsolator`.

```python
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response

from app.core.config import get_settings
from app.models.schemas import SongDetail, SongSummary
from app.services.ingest import ingest_song
from app.services.isolation import DemucsIsolator, Isolator
from app.services.library import Library

router = APIRouter()


def get_library() -> Library:
    return Library(storage_dir=get_settings().storage_dir)


def get_isolator() -> Isolator:
    return DemucsIsolator()


@router.post("/songs", response_model=SongSummary)
async def create_song(
    file: UploadFile,
    library: Library = Depends(get_library),
    isolator: Isolator = Depends(get_isolator),
) -> SongSummary:
    title = Path(file.filename or "untitled").stem
    suffix = Path(file.filename or "upload.mp3").suffix or ".mp3"
    data = await file.read()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)
    try:
        return ingest_song(
            source_path=tmp_path,
            title=title,
            library=library,
            isolator=isolator,
            hop_sec=get_settings().hop_sec,
        )
    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/songs", response_model=list[SongSummary])
def list_songs(library: Library = Depends(get_library)) -> list[SongSummary]:
    return library.list_songs()


@router.get("/songs/{song_id}", response_model=SongDetail)
def get_song(song_id: str, library: Library = Depends(get_library)) -> SongDetail:
    detail = library.get_song(song_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="song not found")
    return detail


@router.get("/songs/{song_id}/stems/{kind}")
def get_stem(song_id: str, kind: str, library: Library = Depends(get_library)) -> Response:
    if library.get_song(song_id) is None:
        raise HTTPException(status_code=404, detail="song not found")
    try:
        data = library.read_stem(song_id, kind)
    except ValueError:
        raise HTTPException(status_code=404, detail="unknown stem kind")
    return Response(content=data, media_type="audio/wav")
```

- [ ] **Step 3: Wire the router into `app/main.py`**

Replace the contents of `app/main.py` with:

```python
from fastapi import FastAPI

from app.api.songs import router as songs_router


def create_app() -> FastAPI:
    app = FastAPI(title="my-v-coach backend")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(songs_router)
    return app


app = create_app()
```

- [ ] **Step 4: Add endpoint tests to `tests/test_api.py`**

Append to `backend/tests/test_api.py`:

```python
import io

import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.api.songs import get_isolator, get_library
from app.main import create_app
from app.services.isolation import StubIsolator
from app.services.library import Library


@pytest.fixture
def client(tmp_path):
    app = create_app()
    library = Library(storage_dir=tmp_path)
    app.dependency_overrides[get_library] = lambda: library
    app.dependency_overrides[get_isolator] = lambda: StubIsolator()
    return TestClient(app)


def _mp3_like_wav_bytes(sr=22050):
    import numpy as np

    t = np.linspace(0.0, 1.0, sr, endpoint=False)
    audio = (0.5 * np.sin(2 * np.pi * 440.0 * t)).astype("float32")
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    return buf.getvalue()


def test_create_then_list_then_get_song(client):
    files = {"file": ("a4.wav", _mp3_like_wav_bytes(), "audio/wav")}
    created = client.post("/songs", files=files)
    assert created.status_code == 200
    song_id = created.json()["id"]
    assert created.json()["title"] == "a4"

    listed = client.get("/songs")
    assert listed.status_code == 200
    assert any(s["id"] == song_id for s in listed.json())

    detail = client.get(f"/songs/{song_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["vocalUrl"] == f"/songs/{song_id}/stems/vocal"
    assert len(body["curve"]["frames"]) > 0


def test_get_missing_song_returns_404(client):
    assert client.get("/songs/nope").status_code == 404


def test_download_vocal_stem(client):
    files = {"file": ("a4.wav", _mp3_like_wav_bytes(), "audio/wav")}
    song_id = client.post("/songs", files=files).json()["id"]
    resp = client.get(f"/songs/{song_id}/stems/vocal")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert len(resp.content) > 0


def test_unknown_stem_kind_returns_404(client):
    files = {"file": ("a4.wav", _mp3_like_wav_bytes(), "audio/wav")}
    song_id = client.post("/songs", files=files).json()["id"]
    assert client.get(f"/songs/{song_id}/stems/drums").status_code == 404
```

- [ ] **Step 5: Run the full fast suite to verify everything passes**

Run: `python -m pytest -v`
Expected: PASS for all tests except the `slow`-marked Demucs test, which is deselected.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api backend/app/main.py backend/tests/test_api.py
git commit -m "feat(backend): add songs API (import, list, detail, stem download)"
```

---

## Task 8: CORS + run instructions + manual smoke

**Files:**
- Modify: `backend/app/main.py` (add CORS for the frontend dev server)
- Create: `backend/README.md`

- [ ] **Step 1: Add a failing test for CORS headers**

Append to `backend/tests/test_api.py`:

```python
def test_cors_allows_frontend_origin():
    client = TestClient(create_app())
    resp = client.options(
        "/songs",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code in (200, 204)
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_api.py::test_cors_allows_frontend_origin -v`
Expected: FAIL — no `access-control-allow-origin` header.

- [ ] **Step 3: Add CORS middleware in `app/main.py`**

Replace the contents of `app/main.py` with:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.songs import router as songs_router


def create_app() -> FastAPI:
    app = FastAPI(title="my-v-coach backend")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],  # Vite dev server
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(songs_router)
    return app


app = create_app()
```

- [ ] **Step 4: Run it to verify it passes**

Run: `python -m pytest tests/test_api.py::test_cors_allows_frontend_origin -v`
Expected: PASS.

- [ ] **Step 5: Create `backend/README.md`**

````markdown
# my-v-coach backend

Local API: ingests an MP3, isolates the vocal (Demucs), analyzes pitch (pYIN),
and serves stems + a pitch curve.

## Setup (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

`ffmpeg` must be on PATH (Demucs needs it to decode MP3). Install via
`winget install Gyan.FFmpeg` or `choco install ffmpeg`.

## Run the tests

```powershell
python -m pytest            # fast suite (default)
python -m pytest -m slow    # real Demucs integration (needs tests/fixtures/clip.wav)
```

## Run the server

```powershell
uvicorn app.main:app --reload --port 8000
```

Then open http://localhost:8000/docs to import a song and inspect responses.

## API

- `POST /songs` — multipart `file` (mp3/wav) → `{id, title, durationSec}`
- `GET  /songs` — list of song summaries
- `GET  /songs/{id}` — full detail incl. embedded pitch curve + stem URLs
- `GET  /songs/{id}/stems/{vocal|instrumental}` — WAV audio
````

- [ ] **Step 6: Manual smoke test (one-time, by the implementer)**

```powershell
uvicorn app.main:app --port 8000
# In a browser, open http://localhost:8000/docs, POST a short real .mp3 to /songs,
# confirm a song id comes back and GET /songs/{id} returns a curve with frames.
```

Expected: a 200 with a song id; GET detail returns `curve.frames` with non-empty pitched regions. (This is the first run that exercises real Demucs; the model downloads on first use.)

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/README.md backend/tests/test_api.py
git commit -m "chore(backend): add CORS for frontend dev server + run docs"
```

---

## Self-Review

**Spec coverage (backend portions of spec §3, §5, §6):**
- Vocal isolation (Demucs → two stems) → Task 5. ✅
- Pitch analysis (pYIN → curve) → Task 3. ✅
- Library store (SQLite + on-disk stems + curve) → Task 4. ✅
- HTTP API (`POST /songs`, `GET /songs`, `GET /songs/{id}`, stem download) → Task 7. ✅
- Pitch-curve data contract (camelCase, `hz:0` = silence, tens of KB) → Task 2 + Task 3. ✅
- Ingest flow decode → isolate → analyze → store → Task 6. ✅
- Backend testing strategy (tones for pitch, integration for isolation, schema validation, API tests) → Tasks 3/5/7. ✅
- Frontend-facing concerns (audio engine, renderer, scoring, octave toggle, A–B loop, calibration) → **out of scope for this plan**; covered by the separate frontend plan. Noted, not a gap.

**Placeholder scan:** No TBD/TODO left. Two intentional "fix this line" notes (Task 5 Step 1 stray `//`, Task 6 Step 3 return annotation) are explicit corrections with the exact change stated, not deferred work.

**Type consistency:** `Library.add_song(...)` returns `SongSummary` everywhere (Tasks 4, 6, 7). `read_stem(song_id, kind)` signature consistent (Tasks 4, 7). `analyze_pitch(audio, sr, hop_sec)` consistent (Tasks 3, 6). `StemSet(vocal, instrumental, sr)` consistent (Tasks 5, 6). `PitchCurve` field `song_id` rewritten on store, asserted in Tasks 4 + 6. camelCase aliases (`songId`, `durationSec`, `vocalUrl`) asserted in Tasks 2 + 7. Consistent.
