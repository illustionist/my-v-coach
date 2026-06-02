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
