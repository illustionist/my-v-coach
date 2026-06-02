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
