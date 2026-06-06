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
