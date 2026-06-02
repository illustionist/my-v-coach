# Vocal Trainer ("my-v-coach") — Design

**Date:** 2026-06-02
**Status:** Approved design, pending implementation plan

## 1. Purpose

A singing-practice app. You open a song, the app shows the **original singer's pitch** as a moving line, and as you sing into your mic it overlays **your pitch** on the same chart so you can see whether you're hitting the same notes and correct yourself in real time.

It must run on both a **PC and a phone**.

## 2. Scope (v1)

**Core practice loop**
- Import an MP3.
- Isolate the original vocal, analyze its pitch, and store a reference pitch curve.
- Play the song and draw the reference pitch line (hybrid piano-roll + continuous line).
- Capture the mic and overlay the user's live pitch with green/red on-pitch feedback.

**Included v1 features**
- **Song library** — list of imported songs with cached pitch curves and stems, so songs are processed only once.
- **A–B loop** — mark a start/end and loop a section to drill a phrase.
- **Session score + record/playback** — accuracy % per run; record the attempt and listen back.
- **Optional octave-tolerant matching** — a user toggle (default **off**) that counts a note as correct when sung in a different octave. For users who can't reach the original's octave.
- **Guide-vocal mix** — a single slider fades the original singer from full → off over the instrumental, covering full-song / karaoke / vocal-solo. Default: **guide vocal low**.
- **Latency calibration** — one-time click-track calibration that aligns live mic pitch to the song clock.

**Explicitly out of scope for v1 (evolve later)**
- Cloud or on-device (WASM) isolation — the API seam is designed so these can replace the local backend later.
- Native desktop/mobile builds.
- Exercises/lessons, multi-user accounts, social features.

## 3. Architecture

Two decoupled halves joined by a thin HTTP API.

### Local backend (Python / FastAPI)
Runs the heavy work **once per new song**:
1. **Vocal isolation** — Demucs splits the MP3 into two stems: original **vocal** and **instrumental/backing**.
2. **Pitch analysis** — librosa **pYIN** (or CREPE) on the vocal stem produces the reference pitch curve.
3. **Library store** — SQLite index + on-disk files (both stems + curve JSON + metadata).
4. **HTTP API** — `POST /songs` (import), `GET /songs` (list), `GET /songs/{id}` (audio stems + curve).

Real-time vocal removal in a browser is poor quality, so the backend persists **both stems**; this roughly doubles a song's stored size, which is acceptable locally.

### Web frontend (PWA — PC + phone)
Does everything **live**, with no network round-trips during practice:
- **Library screen** — import a song; pick from the saved list.
- **Practice screen** — hybrid pitch display, transport, A–B loop, octave toggle, guide-vocal slider, score, record/playback.
- **Audio engine** — plays a mix of the two stems; captures the mic; runs live pitch detection in an **AudioWorklet** (autocorrelation / YIN-style); scores against the reference.
- **Renderer** — scrolling **Canvas 2D** view: note lanes, target blocks, continuous reference line, and the live user line/dot.

### Why this shape
- All real-time work stays in the browser → responsive on phone and PC.
- The backend touches a song only once; the phone can reuse curves/stems already processed on the PC.
- The API is a deliberate seam: "local backend" can later become cloud or on-device without touching the practice screen.

## 4. Pitch display (the main practice screen)

A **hybrid** of two styles:
- **Piano-roll lanes** — notes are horizontal lanes; the melody's **target notes** appear as blocks scrolling toward a fixed "now" line ("hit the note").
- **Continuous lines through the lanes** — a blue line for the original singer's exact pitch (captures slides/vibrato) and an orange line + dot for the user's live pitch.
- The user's dot **turns green when in tune, red when drifting** — a gut-level signal that needs no reading.

## 5. Data flow

**Import (once per song):**
1. User picks an MP3 → frontend uploads to `POST /songs`.
2. Backend decodes (ffmpeg) → Demucs isolation → pitch analysis → caches stems + curve → returns a song record.
3. Song appears in the library.

**Practice (browser, real-time):**
1. Frontend loads the song's stems + pitch curve.
2. Renderer draws lanes + blue reference line; transport starts playback (stems mixed per guide-vocal slider).
3. Audio engine captures mic; AudioWorklet computes user pitch every ~10–20 ms.
4. A pure **scorer** compares user pitch to the reference at the current (latency-corrected) time, applies octave tolerance if toggled, drives the green/red dot, and accumulates the score.
5. Record/playback captures the mic track for listen-back; A–B loop constrains the transport's play range.

## 6. Data contract — reference pitch curve

The one shared piece of data; deliberately small and tool-agnostic. A 3-minute song is tens of KB.

```json
{
  "songId": "abc123",
  "title": "Song Name",
  "durationSec": 212.4,
  "hopSec": 0.01,
  "frames": [
    { "t": 0.50, "hz": 220.0, "conf": 0.93 },
    { "t": 0.51, "hz": 221.6, "conf": 0.90 },
    { "t": 0.52, "hz": 0,     "conf": 0.0  }
  ]
}
```

- `hz: 0` denotes silence / no detected pitch.
- All musical interpretation (Hz → note name → cents-off, octave-folding for tolerance) is derived **on the frontend** from raw `hz`, keeping the backend dumb and the musical logic in one well-tested place.

## 7. Error handling & real-world considerations

- **Mic ↔ playback latency** — one-time click-track calibration measures the offset and aligns live pitch to the song clock; without it the user's line looks shifted.
- **Headphones assumption** — v1 assumes headphones (so the mic doesn't pick up the backing/guide vocal) and shows a gentle one-time reminder. The mic keeps browser echo-cancellation/noise-suppression **off**, since those degrade pitch.
- **Import errors / unsupported file** — clear message; the song is not added half-broken.
- **Weak/absent vocal** (rap, dense mixes, instrumentals) — reference line shows gaps where there's no clear pitch; no crash.
- **Long processing** — import shows progress so it doesn't appear frozen.
- **Mic permission denied** — practice screen still plays the song and explains it can't show the user's line until mic access is granted.

## 8. Testing approach

Strategy: keep the musical logic pure and isolated so it's cheaply and thoroughly testable.

- **Frontend (the brain):** Hz↔note↔cents conversion, octave-tolerant matching, and scoring are pure functions → unit-tested with known inputs. The live pitch detector is tested by feeding **synthetic sine waves** at known frequencies and asserting the reported pitch. Library/practice flows get component tests with a mocked audio engine.
- **Backend:** pitch analysis verified against generated tones (e.g. 440 Hz → ~A4); isolation runs as an integration test on a short sample clip; curve JSON is schema-validated; API endpoints tested directly.
- **End-to-end:** one short sample-song fixture through import → curve → practice with a synthetic mic feed, exercising the full seam.

## 9. Tech stack

- **Frontend:** React + TypeScript (Vite), Canvas 2D for the pitch view, Web Audio API + AudioWorklet for playback/mic/live pitch (autocorrelation / YIN-style), PWA manifest + service worker for install on PC and phone.
- **Backend:** Python + FastAPI (uvicorn), Demucs for stem isolation, librosa pYIN (or CREPE) for the reference curve, ffmpeg for decoding, SQLite + on-disk files for the library.
- **Testing:** vitest + testing-library (frontend), pytest (backend); Playwright optional for e2e later.

## 10. Component boundaries (for implementation planning)

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `backend/isolation` | MP3 → vocal + instrumental stems | Demucs, ffmpeg |
| `backend/pitch` | vocal stem → reference pitch curve | librosa/CREPE |
| `backend/library` | persist/lookup songs, stems, curves | SQLite, filesystem |
| `backend/api` | HTTP endpoints | FastAPI, the three above |
| `frontend/music` | Hz↔note↔cents, octave folding (pure) | — |
| `frontend/scorer` | compare user vs reference, score (pure) | frontend/music |
| `frontend/audio-engine` | playback mix, mic capture, live pitch, calibration | Web Audio, AudioWorklet |
| `frontend/renderer` | scrolling Canvas pitch view | — |
| `frontend/library-ui` | import + song list | backend/api |
| `frontend/practice-ui` | practice screen wiring controls together | audio-engine, renderer, scorer |
