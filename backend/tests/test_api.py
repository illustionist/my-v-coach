import io

import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.api.songs import get_isolator, get_library
from app.main import create_app
from app.services.isolation import StubIsolator
from app.services.library import Library


def test_health_returns_ok():
    client = TestClient(create_app())
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


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
