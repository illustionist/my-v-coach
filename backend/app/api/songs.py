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
