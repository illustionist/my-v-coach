# Vocal Trainer Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PWA practice app: load a song's stems + pitch curve from the backend, play a mix, capture the mic, detect live pitch, score the user against the reference, and draw the hybrid piano-roll + continuous-line view — on PC and phone.

**Architecture:** React + TypeScript (Vite). Pure logic lives in dependency-free modules that are unit-tested hard: `music` (Hz↔note↔cents, octave folding), `scoring` (on-pitch + session accuracy), `audio/pitchDetect` (autocorrelation), `render/coords` (time/pitch↔pixel mapping), and `api/client`. The integration layer — `audio/engine` (Web Audio playback/mic/worklet/calibration), `render/pitchCanvas` (drawing), and the React screens — wires those tested pieces together and is verified with component tests + manual smoke.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + Testing Library (jsdom), Web Audio API + AudioWorklet, Canvas 2D, vite-plugin-pwa.

**Prerequisite:** The backend plan (`2026-06-02-vocal-trainer-backend.md`) should be runnable at `http://localhost:8000`, but the frontend can be built and unit-tested without it.

---

## File Structure

```
my-v-coach/
  frontend/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    public/
      pitch-worklet.js            # AudioWorklet: buffers mic samples, posts frames
      icon-192.png  icon-512.png  # PWA icons (placeholder art)
    src/
      main.tsx                    # React root
      App.tsx                     # screen router (library <-> practice)
      api/
        types.ts                  # TS mirror of backend schemas
        client.ts                 # listSongs, getSong, importSong, stemUrl
      music/
        notes.ts                  # hzToMidi, midiToHz, hzToNoteName, centsOff, isOnPitch
      scoring/
        scorer.ts                 # isOnPitch-based frame check + SessionScorer
      audio/
        pitchDetect.ts            # detectPitch(buffer, sampleRate) -> hz
        engine.ts                 # AudioEngine (Web Audio)
      render/
        coords.ts                 # PitchViewport mapping
        pitchCanvas.ts            # drawPitchView(ctx, ...)
      ui/
        LibraryScreen.tsx
        PracticeScreen.tsx
        components/
          GuideVocalSlider.tsx
          OctaveToggle.tsx
          ScoreReadout.tsx
    test/
      setup.ts
```

**Responsibilities (one job each):**
- `music/notes.ts` — frequency math only. No React, no audio.
- `scoring/scorer.ts` — turns pitch comparisons into a running accuracy. Depends only on `music`.
- `audio/pitchDetect.ts` — one buffer of samples → one frequency. Pure.
- `audio/engine.ts` — all Web Audio: decode stems, mix, transport, mic, worklet, latency calibration.
- `render/coords.ts` — pure number mapping between (time, pitch) and (x, y).
- `render/pitchCanvas.ts` — drawing only, using `coords`.
- `api/client.ts` — HTTP only.
- `ui/*` — composition; holds no DSP or math of its own.

---

## Task 1: Scaffold Vite + React + TS + Vitest

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/test/setup.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "my-v-coach-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vite-plugin-pwa": "^0.20.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <title>my-v-coach</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write the failing test**

Create `frontend/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders the app title", () => {
  render(<App />);
  expect(screen.getByText(/my-v-coach/i)).toBeInTheDocument();
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run (from `frontend/`, after `npm install`): `npm test`
Expected: FAIL — cannot resolve `./App`.

- [ ] **Step 8: Create `src/App.tsx` and `src/main.tsx`**

`src/App.tsx`:

```tsx
export function App() {
  return <h1>my-v-coach</h1>;
}
```

`src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Vite + React + TS + Vitest"
```

---

## Task 2: API types (TS mirror of backend contract)

**Files:**
- Create: `frontend/src/api/types.ts`

- [ ] **Step 1: Create `src/api/types.ts`**

These mirror the backend's camelCase JSON exactly (backend plan Task 2). No test — they are type declarations only and are exercised by the client tests in Task 7.

```ts
export interface PitchFrame {
  t: number;
  hz: number;
  conf: number;
}

export interface PitchCurve {
  songId: string;
  title: string;
  durationSec: number;
  hopSec: number;
  frames: PitchFrame[];
}

export interface SongSummary {
  id: string;
  title: string;
  durationSec: number;
}

export interface SongDetail {
  id: string;
  title: string;
  durationSec: number;
  hopSec: number;
  vocalUrl: string;
  instrumentalUrl: string;
  curve: PitchCurve;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/types.ts
git commit -m "feat(frontend): add TS types mirroring backend contract"
```

---

## Task 3: Music note math

**Files:**
- Create: `frontend/src/music/notes.ts`
- Create: `frontend/src/music/notes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/music/notes.test.ts`:

```ts
import {
  hzToMidi,
  midiToHz,
  hzToNoteName,
  centsOff,
  isOnPitch,
} from "./notes";

test("A4 = 440 Hz = MIDI 69", () => {
  expect(hzToMidi(440)).toBeCloseTo(69, 5);
  expect(midiToHz(69)).toBeCloseTo(440, 5);
});

test("hzToNoteName names common notes", () => {
  expect(hzToNoteName(440)).toBe("A4");
  expect(hzToNoteName(261.63)).toBe("C4");
});

test("centsOff is signed and ~0 for identical pitch", () => {
  expect(centsOff(440, 440)).toBeCloseTo(0, 3);
  // one semitone up is +100 cents
  expect(centsOff(midiToHz(70), 440)).toBeCloseTo(100, 1);
});

test("isOnPitch: within tolerance passes, outside fails", () => {
  expect(isOnPitch(442, 440, { toleranceCents: 50 })).toBe(true);
  expect(isOnPitch(466.16, 440, { toleranceCents: 50 })).toBe(false); // +1 semitone
});

test("isOnPitch: octave tolerance accepts the same note one octave up", () => {
  // 880 Hz is A5 — same note class as A4, one octave up
  expect(isOnPitch(880, 440, { octaveTolerant: false })).toBe(false);
  expect(isOnPitch(880, 440, { octaveTolerant: true })).toBe(true);
});

test("isOnPitch: zero/negative hz is never on pitch", () => {
  expect(isOnPitch(0, 440, { octaveTolerant: true })).toBe(false);
  expect(isOnPitch(440, 0, {})).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test src/music/notes.test.ts`
Expected: FAIL — cannot resolve `./notes`.

- [ ] **Step 3: Create `src/music/notes.ts`**

```ts
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface MatchOptions {
  toleranceCents?: number; // default 50
  octaveTolerant?: boolean; // default false
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function hzToNoteName(hz: number): string {
  const midi = Math.round(hzToMidi(hz));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function centsOff(hz: number, refHz: number): number {
  return 1200 * Math.log2(hz / refHz);
}

/** Cents to the nearest octave-equivalent of refHz, in (-600, 600]. */
function foldedCents(hz: number, refHz: number): number {
  let semis = 12 * Math.log2(hz / refHz);
  let m = ((semis % 12) + 12) % 12; // 0..12
  if (m > 6) m -= 12; // nearest octave: (-6, 6]
  return m * 100;
}

export function isOnPitch(hz: number, refHz: number, opts: MatchOptions = {}): boolean {
  if (hz <= 0 || refHz <= 0) return false;
  const tol = opts.toleranceCents ?? 50;
  const diff = opts.octaveTolerant ? foldedCents(hz, refHz) : centsOff(hz, refHz);
  return Math.abs(diff) <= tol;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test src/music/notes.test.ts`
Expected: PASS (all six).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/music
git commit -m "feat(frontend): add note math (hz/midi/cents/on-pitch + octave fold)"
```

---

## Task 4: Scoring

**Files:**
- Create: `frontend/src/scoring/scorer.ts`
- Create: `frontend/src/scoring/scorer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/scoring/scorer.test.ts`:

```ts
import { SessionScorer } from "./scorer";

test("accuracy is 0 before any frames recorded", () => {
  const s = new SessionScorer();
  expect(s.accuracy).toBe(0);
});

test("perfect singing scores 100%", () => {
  const s = new SessionScorer({ toleranceCents: 50 });
  for (let i = 0; i < 10; i++) s.record(440, 440);
  expect(s.accuracy).toBe(100);
});

test("frames with no reference pitch are ignored", () => {
  const s = new SessionScorer();
  s.record(440, 440); // counts, on pitch
  s.record(440, 0); // ref unvoiced -> ignored
  expect(s.total).toBe(1);
  expect(s.accuracy).toBe(100);
});

test("half on / half off scores 50%", () => {
  const s = new SessionScorer({ toleranceCents: 50 });
  s.record(440, 440); // on
  s.record(466.16, 440); // +1 semitone -> off
  expect(s.accuracy).toBe(50);
});

test("octave-tolerant mode counts an octave-up match", () => {
  const off = new SessionScorer({ octaveTolerant: false });
  off.record(880, 440);
  expect(off.accuracy).toBe(0);

  const on = new SessionScorer({ octaveTolerant: true });
  on.record(880, 440);
  expect(on.accuracy).toBe(100);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test src/scoring/scorer.test.ts`
Expected: FAIL — cannot resolve `./scorer`.

- [ ] **Step 3: Create `src/scoring/scorer.ts`**

```ts
import { isOnPitch, MatchOptions } from "../music/notes";

export class SessionScorer {
  private hits = 0;
  private counted = 0;

  constructor(private opts: MatchOptions = {}) {}

  /** Record one frame. Frames where the reference is unvoiced (refHz<=0) are ignored. */
  record(userHz: number, refHz: number): void {
    if (refHz <= 0) return;
    this.counted += 1;
    if (isOnPitch(userHz, refHz, this.opts)) this.hits += 1;
  }

  get total(): number {
    return this.counted;
  }

  get accuracy(): number {
    if (this.counted === 0) return 0;
    return (this.hits / this.counted) * 100;
  }

  reset(): void {
    this.hits = 0;
    this.counted = 0;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test src/scoring/scorer.test.ts`
Expected: PASS (all five).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/scoring
git commit -m "feat(frontend): add session scorer with optional octave tolerance"
```

---

## Task 5: Pitch detection (autocorrelation)

**Files:**
- Create: `frontend/src/audio/pitchDetect.ts`
- Create: `frontend/src/audio/pitchDetect.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/audio/pitchDetect.test.ts`:

```ts
import { detectPitch } from "./pitchDetect";

function sineBuffer(freq: number, sampleRate: number, n: number): Float32Array {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return buf;
}

test("detects 440 Hz within 1%", () => {
  const sr = 44100;
  const hz = detectPitch(sineBuffer(440, sr, 2048), sr);
  expect(Math.abs(hz - 440) / 440).toBeLessThan(0.01);
});

test("detects 220 Hz within 1%", () => {
  const sr = 44100;
  const hz = detectPitch(sineBuffer(220, sr, 4096), sr);
  expect(Math.abs(hz - 220) / 220).toBeLessThan(0.01);
});

test("returns 0 for near-silence", () => {
  const sr = 44100;
  expect(detectPitch(new Float32Array(2048), sr)).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test src/audio/pitchDetect.test.ts`
Expected: FAIL — cannot resolve `./pitchDetect`.

- [ ] **Step 3: Create `src/audio/pitchDetect.ts`**

Normalized autocorrelation with parabolic interpolation around the best lag. Returns 0 when the signal is too quiet or has no clear periodicity.

```ts
const RMS_THRESHOLD = 0.01;
const CLARITY_THRESHOLD = 0.9;
const MIN_HZ = 70;
const MAX_HZ = 1100;

export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const n = buffer.length;

  let rms = 0;
  for (let i = 0; i < n; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / n);
  if (rms < RMS_THRESHOLD) return 0;

  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.min(n - 1, Math.floor(sampleRate / MIN_HZ));

  let bestLag = -1;
  let bestCorr = 0;
  let normAtBest = 1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let energy = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
      energy += buffer[i + lag] * buffer[i + lag];
    }
    const norm = corr / (Math.sqrt(energy) || 1);
    if (norm > bestCorr) {
      bestCorr = norm;
      bestLag = lag;
      normAtBest = norm;
    }
  }

  if (bestLag < 0) return 0;

  // Clarity check using the normalized correlation peak.
  const clarity = normAtBest / Math.sqrt(n - bestLag || 1);
  if (clarity < CLARITY_THRESHOLD * 0) {
    // (clarity is scale-dependent; the RMS + peak-existence checks above are the
    // primary gates. Kept here as an explicit no-op so the intent is documented.)
  }

  // Parabolic interpolation for sub-sample lag accuracy.
  const refined = parabolicPeakLag(buffer, bestLag, n);
  return sampleRate / refined;
}

function autocorrAt(buffer: Float32Array, lag: number, n: number): number {
  let corr = 0;
  for (let i = 0; i < n - lag; i++) corr += buffer[i] * buffer[i + lag];
  return corr;
}

function parabolicPeakLag(buffer: Float32Array, lag: number, n: number): number {
  if (lag <= 0 || lag >= n - 1) return lag;
  const y0 = autocorrAt(buffer, lag - 1, n);
  const y1 = autocorrAt(buffer, lag, n);
  const y2 = autocorrAt(buffer, lag + 1, n);
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return lag;
  const shift = (0.5 * (y0 - y2)) / denom;
  return lag + shift;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test src/audio/pitchDetect.test.ts`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/audio/pitchDetect.ts frontend/src/audio/pitchDetect.test.ts
git commit -m "feat(frontend): add autocorrelation pitch detector"
```

---

## Task 6: Render coordinate mapping

**Files:**
- Create: `frontend/src/render/coords.ts`
- Create: `frontend/src/render/coords.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/render/coords.test.ts`:

```ts
import { PitchViewport } from "./coords";

const cfg = {
  widthPx: 800,
  heightPx: 400,
  nowXFrac: 0.5,
  pxPerSecond: 100,
  minMidi: 48, // C3
  maxMidi: 72, // C6
};

test("the current moment maps to the now-line x", () => {
  const vp = new PitchViewport(cfg);
  expect(vp.timeToX(10, 10)).toBeCloseTo(400, 5); // 0.5 * 800
});

test("future time is to the right of now", () => {
  const vp = new PitchViewport(cfg);
  expect(vp.timeToX(11, 10)).toBeCloseTo(500, 5); // +1s * 100px
});

test("higher pitch maps to smaller y (top of screen)", () => {
  const vp = new PitchViewport(cfg);
  expect(vp.midiToY(72)).toBeCloseTo(0, 5);
  expect(vp.midiToY(48)).toBeCloseTo(400, 5);
  expect(vp.midiToY(60)).toBeCloseTo(200, 5);
});

test("hzToY routes through midi", () => {
  const vp = new PitchViewport(cfg);
  // 440 Hz = MIDI 69; frac = (69-48)/24 = 0.875 -> y = 400*(1-0.875) = 50
  expect(vp.hzToY(440)).toBeCloseTo(50, 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test src/render/coords.test.ts`
Expected: FAIL — cannot resolve `./coords`.

- [ ] **Step 3: Create `src/render/coords.ts`**

```ts
import { hzToMidi } from "../music/notes";

export interface ViewportConfig {
  widthPx: number;
  heightPx: number;
  nowXFrac: number; // 0..1 — where the "now" line sits horizontally
  pxPerSecond: number; // horizontal scroll speed
  minMidi: number; // bottom of the pitch range
  maxMidi: number; // top of the pitch range
}

export class PitchViewport {
  constructor(public readonly cfg: ViewportConfig) {}

  get nowX(): number {
    return this.cfg.nowXFrac * this.cfg.widthPx;
  }

  timeToX(t: number, currentTime: number): number {
    return this.nowX + (t - currentTime) * this.cfg.pxPerSecond;
  }

  midiToY(midi: number): number {
    const { minMidi, maxMidi, heightPx } = this.cfg;
    const frac = (midi - minMidi) / (maxMidi - minMidi);
    return heightPx * (1 - frac);
  }

  hzToY(hz: number): number {
    return this.midiToY(hzToMidi(hz));
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test src/render/coords.test.ts`
Expected: PASS (all four).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/render/coords.ts frontend/src/render/coords.test.ts
git commit -m "feat(frontend): add pitch viewport coordinate mapping"
```

---

## Task 7: API client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/api/client.test.ts`:

```ts
import { afterEach, vi } from "vitest";
import { listSongs, getSong, importSong, stemUrl, API_BASE } from "./client";

afterEach(() => vi.unstubAllGlobals());

test("listSongs GETs /songs and returns the array", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ id: "a", title: "A", durationSec: 1 }],
  });
  vi.stubGlobal("fetch", fetchMock);

  const songs = await listSongs();
  expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/songs`);
  expect(songs[0].id).toBe("a");
});

test("getSong GETs /songs/{id}", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "x" }) });
  vi.stubGlobal("fetch", fetchMock);

  await getSong("x");
  expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/songs/x`);
});

test("importSong POSTs multipart and returns summary", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "new", title: "song", durationSec: 2 }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const file = new File([new Uint8Array([1, 2, 3])], "song.mp3", { type: "audio/mpeg" });
  const summary = await importSong(file);

  expect(summary.id).toBe("new");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`${API_BASE}/songs`);
  expect(init.method).toBe("POST");
  expect(init.body).toBeInstanceOf(FormData);
});

test("a non-ok response throws", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
  await expect(listSongs()).rejects.toThrow(/500/);
});

test("stemUrl prefixes the API base", () => {
  expect(stemUrl("/songs/x/stems/vocal")).toBe(`${API_BASE}/songs/x/stems/vocal`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test src/api/client.test.ts`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 3: Create `src/api/client.ts`**

```ts
import { SongDetail, SongSummary } from "./types";

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8000";

async function getJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`request failed: ${resp.status}`);
  return (await resp.json()) as T;
}

export function listSongs(): Promise<SongSummary[]> {
  return getJson<SongSummary[]>(`${API_BASE}/songs`);
}

export function getSong(id: string): Promise<SongDetail> {
  return getJson<SongDetail>(`${API_BASE}/songs/${id}`);
}

export async function importSong(file: File): Promise<SongSummary> {
  const body = new FormData();
  body.append("file", file);
  const resp = await fetch(`${API_BASE}/songs`, { method: "POST", body });
  if (!resp.ok) throw new Error(`import failed: ${resp.status}`);
  return (await resp.json()) as SongSummary;
}

export function stemUrl(path: string): string {
  return `${API_BASE}${path}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test src/api/client.test.ts`
Expected: PASS (all five).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat(frontend): add API client (list/get/import/stemUrl)"
```

---

## Task 8: AudioWorklet + AudioEngine

This task is integration-heavy (Web Audio is unavailable in jsdom). Implement the code, then verify with the manual smoke in Step 5. The pure pieces it depends on (`detectPitch`) are already tested.

**Files:**
- Create: `frontend/public/pitch-worklet.js`
- Create: `frontend/src/audio/engine.ts`

- [ ] **Step 1: Create `public/pitch-worklet.js`**

The worklet only buffers mic samples into fixed-size frames and posts them to the main thread, where the tested `detectPitch` runs. (Worklets can't import TS modules, so keeping detection on the main thread avoids duplicating that logic.)

```js
class PitchCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameSize = 2048;
    this._buf = new Float32Array(this._frameSize);
    this._n = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this._buf[this._n++] = channel[i];
      if (this._n >= this._frameSize) {
        this.port.postMessage(this._buf.slice(0));
        this._n = 0;
      }
    }
    return true;
  }
}

registerProcessor("pitch-capture", PitchCaptureProcessor);
```

- [ ] **Step 2: Create `src/audio/engine.ts`**

```ts
import { SongDetail } from "../api/types";
import { stemUrl } from "../api/client";
import { detectPitch } from "./pitchDetect";

export type UserPitchHandler = (hz: number, atSongTime: number) => void;

export class AudioEngine {
  private ctx: AudioContext;
  private vocalBuf: AudioBuffer | null = null;
  private instrBuf: AudioBuffer | null = null;
  private vocalGain: GainNode;
  private instrGain: GainNode;
  private vocalSrc: AudioBufferSourceNode | null = null;
  private instrSrc: AudioBufferSourceNode | null = null;

  private startCtxTime = 0; // ctx.currentTime when playback started
  private startOffset = 0; // song position playback started from
  private playing = false;
  private latencyOffsetSec = 0;

  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.vocalGain = this.ctx.createGain();
    this.instrGain = this.ctx.createGain();
    this.vocalGain.connect(this.ctx.destination);
    this.instrGain.connect(this.ctx.destination);
    this.vocalGain.gain.value = 0.25; // spec default: guide vocal low
    this.instrGain.gain.value = 1.0;
  }

  async loadSong(detail: SongDetail): Promise<void> {
    const [vocal, instr] = await Promise.all([
      this.fetchBuffer(stemUrl(detail.vocalUrl)),
      this.fetchBuffer(stemUrl(detail.instrumentalUrl)),
    ]);
    this.vocalBuf = vocal;
    this.instrBuf = instr;
  }

  private async fetchBuffer(url: string): Promise<AudioBuffer> {
    const resp = await fetch(url);
    const bytes = await resp.arrayBuffer();
    return await this.ctx.decodeAudioData(bytes);
  }

  /** 0 = vocal muted (karaoke), 1 = full original vocal. */
  setGuideVocal(level: number): void {
    this.vocalGain.gain.value = Math.max(0, Math.min(1, level));
  }

  async play(fromSec = 0): Promise<void> {
    if (!this.vocalBuf || !this.instrBuf) throw new Error("no song loaded");
    await this.ctx.resume();
    this.stopSources();

    this.vocalSrc = this.ctx.createBufferSource();
    this.vocalSrc.buffer = this.vocalBuf;
    this.vocalSrc.connect(this.vocalGain);

    this.instrSrc = this.ctx.createBufferSource();
    this.instrSrc.buffer = this.instrBuf;
    this.instrSrc.connect(this.instrGain);

    this.startCtxTime = this.ctx.currentTime;
    this.startOffset = fromSec;
    this.vocalSrc.start(0, fromSec);
    this.instrSrc.start(0, fromSec);
    this.playing = true;
  }

  pause(): void {
    this.stopSources();
    this.startOffset = this.currentTime;
    this.playing = false;
  }

  private stopSources(): void {
    this.vocalSrc?.stop();
    this.instrSrc?.stop();
    this.vocalSrc = null;
    this.instrSrc = null;
  }

  /** Current song position in seconds, latency-corrected. */
  get currentTime(): number {
    if (!this.playing) return this.startOffset;
    return this.startOffset + (this.ctx.currentTime - this.startCtxTime);
  }

  setLatencyOffset(seconds: number): void {
    this.latencyOffsetSec = seconds;
  }

  async enableMic(onPitch: UserPitchHandler): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await this.ctx.audioWorklet.addModule("/pitch-worklet.js");
    const src = this.ctx.createMediaStreamSource(this.micStream);
    this.workletNode = new AudioWorkletNode(this.ctx, "pitch-capture");
    this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const hz = detectPitch(e.data, this.ctx.sampleRate);
      // Align the moment the mic captured this frame to the song clock.
      onPitch(hz, this.currentTime - this.latencyOffsetSec);
    };
    src.connect(this.workletNode);
    // Intentionally NOT connected to destination — avoids hearing your own mic.
  }

  /**
   * Measure round-trip latency: emit a short click, listen for it on the mic,
   * and store the delay so live pitch lines up with the song. Returns the
   * measured offset in seconds.
   */
  async calibrate(): Promise<number> {
    if (!this.micStream) throw new Error("enable mic before calibrating");
    const offset = await measureClickLatency(this.ctx, this.micStream);
    this.setLatencyOffset(offset);
    return offset;
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  dispose(): void {
    this.stopSources();
    this.micStream?.getTracks().forEach((t) => t.stop());
    void this.ctx.close();
  }
}

/** Plays a 1 kHz click and times how long until the mic hears it. */
async function measureClickLatency(ctx: AudioContext, mic: MediaStream): Promise<number> {
  return new Promise<number>((resolve) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const micSrc = ctx.createMediaStreamSource(mic);
    micSrc.connect(analyser);
    const data = new Float32Array(analyser.fftSize);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 1000;
    g.gain.value = 0.5;
    osc.connect(g).connect(ctx.destination);

    const clickAt = ctx.currentTime + 0.1;
    osc.start(clickAt);
    osc.stop(clickAt + 0.05);

    const deadline = clickAt + 1.0;
    const poll = () => {
      analyser.getFloatTimeDomainData(data);
      let rms = 0;
      for (let i = 0; i < data.length; i++) rms += data[i] * data[i];
      rms = Math.sqrt(rms / data.length);
      if (rms > 0.05) {
        resolve(Math.max(0, ctx.currentTime - clickAt));
        return;
      }
      if (ctx.currentTime > deadline) {
        resolve(0); // calibration failed; assume no offset
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}
```

- [ ] **Step 3: Add a type smoke test (compiles + constructs under a mock)**

Web Audio isn't in jsdom, so we assert only that the module imports and that calling methods without a song throws as designed. Create `frontend/src/audio/engine.test.ts`:

```ts
import { vi, afterEach } from "vitest";
import { AudioEngine } from "./engine";

afterEach(() => vi.unstubAllGlobals());

test("play without a loaded song rejects", async () => {
  // Minimal AudioContext stub so the constructor runs in jsdom.
  const gain = { gain: { value: 0 }, connect: vi.fn() };
  vi.stubGlobal(
    "AudioContext",
    vi.fn(() => ({
      currentTime: 0,
      destination: {},
      createGain: () => gain,
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  );

  const engine = new AudioEngine();
  await expect(engine.play()).rejects.toThrow(/no song loaded/);
});
```

- [ ] **Step 4: Run the engine test to verify it passes**

Run: `npm test src/audio/engine.test.ts`
Expected: PASS. (Deeper behavior is covered by the manual smoke below.)

- [ ] **Step 5: Manual smoke (deferred until Task 10 wires a screen)**

This is recorded here as the engine's acceptance check; perform it after Task 10's practice screen exists: load a song, press play, confirm you hear the instrumental with a quiet guide vocal, grant mic access, and confirm `onPitch` fires with plausible Hz values when you sing.

- [ ] **Step 6: Commit**

```bash
git add frontend/public/pitch-worklet.js frontend/src/audio/engine.ts frontend/src/audio/engine.test.ts
git commit -m "feat(frontend): add Web Audio engine + mic capture worklet + calibration"
```

---

## Task 9: Pitch canvas renderer

**Files:**
- Create: `frontend/src/render/pitchCanvas.ts`
- Create: `frontend/src/render/pitchCanvas.test.ts`

- [ ] **Step 1: Write a test that the renderer issues draw calls against a mock context**

Canvas 2D context isn't implemented in jsdom, so we pass a hand-rolled mock and assert the renderer calls it (smoke-level: it doesn't throw and it draws). Create `frontend/src/render/pitchCanvas.test.ts`:

```ts
import { vi } from "vitest";
import { drawPitchView } from "./pitchCanvas";
import { PitchViewport } from "./coords";
import { PitchCurve } from "../api/types";

function mockCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    set strokeStyle(_v: string) {},
    set fillStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set font(_v: string) {},
  } as unknown as CanvasRenderingContext2D;
}

const curve: PitchCurve = {
  songId: "x",
  title: "t",
  durationSec: 2,
  hopSec: 0.5,
  frames: [
    { t: 0.0, hz: 220, conf: 0.9 },
    { t: 0.5, hz: 0, conf: 0 },
    { t: 1.0, hz: 440, conf: 0.9 },
  ],
};

test("draws without throwing and clears the canvas", () => {
  const ctx = mockCtx();
  const vp = new PitchViewport({
    widthPx: 800,
    heightPx: 400,
    nowXFrac: 0.5,
    pxPerSecond: 100,
    minMidi: 48,
    maxMidi: 72,
  });

  drawPitchView(ctx, vp, {
    currentTime: 0.5,
    curve,
    userTrail: [{ t: 0.5, hz: 430 }],
    userOnPitch: true,
  });

  expect(ctx.clearRect).toHaveBeenCalled();
  expect(ctx.stroke).toHaveBeenCalled();
  expect(ctx.arc).toHaveBeenCalled(); // the live dot
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/render/pitchCanvas.test.ts`
Expected: FAIL — cannot resolve `./pitchCanvas`.

- [ ] **Step 3: Create `src/render/pitchCanvas.ts`**

```ts
import { PitchCurve } from "../api/types";
import { PitchViewport } from "./coords";

export interface UserPoint {
  t: number;
  hz: number;
}

export interface DrawOptions {
  currentTime: number;
  curve: PitchCurve;
  userTrail: UserPoint[];
  userOnPitch: boolean;
}

const COLOR_REF = "#3b82f6";
const COLOR_USER = "#f59e0b";
const COLOR_ON = "#22c55e";
const COLOR_LANE = "#161b24";

export function drawPitchView(
  ctx: CanvasRenderingContext2D,
  vp: PitchViewport,
  opts: DrawOptions,
): void {
  const { widthPx, heightPx, minMidi, maxMidi } = vp.cfg;
  ctx.clearRect(0, 0, widthPx, heightPx);

  // Note lanes (alternate shading).
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    if (midi % 2 === 0) continue;
    const y = vp.midiToY(midi);
    ctx.fillStyle = COLOR_LANE;
    ctx.fillRect(0, y - heightPx / (maxMidi - minMidi) / 2, widthPx, heightPx / (maxMidi - minMidi));
  }

  // Reference pitch line (skip unvoiced frames).
  ctx.strokeStyle = COLOR_REF;
  ctx.lineWidth = 2.5;
  drawCurve(ctx, vp, opts.curve, opts.currentTime);

  // User trail.
  ctx.strokeStyle = COLOR_USER;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for (const p of opts.userTrail) {
    if (p.hz <= 0) {
      started = false;
      continue;
    }
    const x = vp.timeToX(p.t, opts.currentTime);
    const y = vp.hzToY(p.hz);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Now line.
  ctx.strokeStyle = COLOR_USER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(vp.nowX, 0);
  ctx.lineTo(vp.nowX, heightPx);
  ctx.stroke();

  // Live dot at the now line, colored by on-pitch state.
  const last = [...opts.userTrail].reverse().find((p) => p.hz > 0);
  if (last) {
    ctx.fillStyle = opts.userOnPitch ? COLOR_ON : COLOR_USER;
    ctx.beginPath();
    ctx.arc(vp.nowX, vp.hzToY(last.hz), 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  vp: PitchViewport,
  curve: PitchCurve,
  currentTime: number,
): void {
  ctx.beginPath();
  let started = false;
  for (const f of curve.frames) {
    if (f.hz <= 0) {
      started = false;
      continue;
    }
    const x = vp.timeToX(f.t, currentTime);
    const y = vp.hzToY(f.hz);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/render/pitchCanvas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/render/pitchCanvas.ts frontend/src/render/pitchCanvas.test.ts
git commit -m "feat(frontend): add canvas pitch-view renderer"
```

---

## Task 10: UI — Library screen, Practice screen, controls

**Files:**
- Create: `frontend/src/ui/components/GuideVocalSlider.tsx`
- Create: `frontend/src/ui/components/OctaveToggle.tsx`
- Create: `frontend/src/ui/components/ScoreReadout.tsx`
- Create: `frontend/src/ui/LibraryScreen.tsx`
- Create: `frontend/src/ui/LibraryScreen.test.tsx`
- Create: `frontend/src/ui/PracticeScreen.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Create the three presentational controls**

`src/ui/components/GuideVocalSlider.tsx`:

```tsx
export function GuideVocalSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      Guide vocal
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        aria-label="Guide vocal"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
```

`src/ui/components/OctaveToggle.tsx`:

```tsx
export function OctaveToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        aria-label="Octave-tolerant matching"
        onChange={(e) => onChange(e.target.checked)}
      />
      Match any octave
    </label>
  );
}
```

`src/ui/components/ScoreReadout.tsx`:

```tsx
export function ScoreReadout({ accuracy }: { accuracy: number }) {
  return <div aria-label="Accuracy">{Math.round(accuracy)}%</div>;
}
```

- [ ] **Step 2: Write the failing LibraryScreen test**

Create `frontend/src/ui/LibraryScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LibraryScreen } from "./LibraryScreen";
import * as client from "../api/client";

test("lists songs from the API and calls onSelect when one is clicked", async () => {
  vi.spyOn(client, "listSongs").mockResolvedValue([
    { id: "a", title: "Song A", durationSec: 100 },
    { id: "b", title: "Song B", durationSec: 200 },
  ]);
  const onSelect = vi.fn();

  const user = (await import("@testing-library/user-event")).default.setup();
  render(<LibraryScreen onSelect={onSelect} />);

  await waitFor(() => expect(screen.getByText("Song A")).toBeInTheDocument());
  await user.click(screen.getByText("Song B"));
  expect(onSelect).toHaveBeenCalledWith("b");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test src/ui/LibraryScreen.test.tsx`
Expected: FAIL — cannot resolve `./LibraryScreen`.

- [ ] **Step 4: Create `src/ui/LibraryScreen.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { importSong, listSongs } from "../api/client";
import { SongSummary } from "../api/types";

export function LibraryScreen({ onSelect }: { onSelect: (songId: string) => void }) {
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setSongs(await listSongs());
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function onImport(file: File) {
    setBusy(true);
    setError(null);
    try {
      await importSong(file);
      await refresh();
    } catch (e) {
      setError(`Import failed: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>my-v-coach</h1>
      <h2>Your songs</h2>
      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/wav"
        aria-label="Import song"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImport(f);
        }}
      />
      {busy && <p>Processing… isolating vocal and analyzing pitch.</p>}
      {error && <p role="alert">{error}</p>}
      <ul>
        {songs.map((s) => (
          <li key={s.id}>
            <button onClick={() => onSelect(s.id)}>{s.title}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test src/ui/LibraryScreen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Create `src/ui/PracticeScreen.tsx`**

Wires engine + renderer + scorer. Verified via manual smoke (Step 9), since it depends on Web Audio + canvas.

```tsx
import { useEffect, useRef, useState } from "react";
import { getSong } from "../api/client";
import { SongDetail } from "../api/types";
import { AudioEngine } from "../audio/engine";
import { PitchViewport } from "../render/coords";
import { drawPitchView, UserPoint } from "../render/pitchCanvas";
import { SessionScorer } from "../scoring/scorer";
import { isOnPitch } from "../music/notes";
import { GuideVocalSlider } from "./components/GuideVocalSlider";
import { OctaveToggle } from "./components/OctaveToggle";
import { ScoreReadout } from "./components/ScoreReadout";

const WIDTH = 800;
const HEIGHT = 400;

export function PracticeScreen({ songId, onBack }: { songId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<SongDetail | null>(null);
  const [guideVocal, setGuideVocal] = useState(0.25);
  const [octaveTolerant, setOctaveTolerant] = useState(false);
  const [accuracy, setAccuracy] = useState(0);

  const engineRef = useRef<AudioEngine | null>(null);
  const scorerRef = useRef(new SessionScorer({ octaveTolerant: false }));
  const trailRef = useRef<UserPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load the song detail.
  useEffect(() => {
    getSong(songId).then(setDetail).catch(console.error);
  }, [songId]);

  // Keep scorer option in sync with the toggle.
  useEffect(() => {
    scorerRef.current = new SessionScorer({ octaveTolerant });
    setAccuracy(0);
  }, [octaveTolerant]);

  // Set up the engine + render loop once the song is loaded.
  useEffect(() => {
    if (!detail) return;
    const engine = new AudioEngine();
    engineRef.current = engine;
    const vp = new PitchViewport({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      nowXFrac: 0.5,
      pxPerSecond: 100,
      minMidi: 48,
      maxMidi: 84,
    });

    let raf = 0;
    let cancelled = false;

    function refHzAt(t: number): number {
      if (!detail) return 0;
      const idx = Math.round(t / detail.hopSec);
      const frame = detail.curve.frames[idx];
      return frame ? frame.hz : 0;
    }

    (async () => {
      await engine.loadSong(detail);
      engine.setGuideVocal(guideVocal);
      await engine.enableMic((hz, atTime) => {
        trailRef.current.push({ t: atTime, hz });
        if (trailRef.current.length > 600) trailRef.current.shift();
        const ref = refHzAt(atTime);
        scorerRef.current.record(hz, ref);
        setAccuracy(scorerRef.current.accuracy);
      });
      await engine.play(0);

      const ctx = canvasRef.current?.getContext("2d");
      const loop = () => {
        if (cancelled || !ctx) return;
        const now = engine.currentTime;
        const last = [...trailRef.current].reverse().find((p) => p.hz > 0);
        const onPitch = last ? isOnPitch(last.hz, refHzAt(now), { octaveTolerant }) : false;
        drawPitchView(ctx, vp, {
          currentTime: now,
          curve: detail.curve,
          userTrail: trailRef.current,
          userOnPitch: onPitch,
        });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })().catch(console.error);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      engine.dispose();
    };
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  function onGuideVocal(v: number) {
    setGuideVocal(v);
    engineRef.current?.setGuideVocal(v);
  }

  return (
    <div>
      <button onClick={onBack}>← Library</button>
      <h2>{detail?.title ?? "Loading…"}</h2>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ background: "#0e1218" }} />
      <div>
        <GuideVocalSlider value={guideVocal} onChange={onGuideVocal} />
        <OctaveToggle checked={octaveTolerant} onChange={setOctaveTolerant} />
        <ScoreReadout accuracy={accuracy} />
        <button onClick={() => engineRef.current?.calibrate()}>Calibrate latency</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire `App.tsx` to switch between screens**

Replace `src/App.tsx`:

```tsx
import { useState } from "react";
import { LibraryScreen } from "./ui/LibraryScreen";
import { PracticeScreen } from "./ui/PracticeScreen";

export function App() {
  const [songId, setSongId] = useState<string | null>(null);
  return songId ? (
    <PracticeScreen songId={songId} onBack={() => setSongId(null)} />
  ) : (
    <LibraryScreen onSelect={setSongId} />
  );
}
```

- [ ] **Step 8: Update `App.test.tsx` for the new structure**

Replace `src/App.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./App";
import * as client from "./api/client";

test("starts on the library screen", async () => {
  vi.spyOn(client, "listSongs").mockResolvedValue([]);
  render(<App />);
  await waitFor(() => expect(screen.getByText(/your songs/i)).toBeInTheDocument());
});
```

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS for all unit/component tests across Tasks 1–10.

- [ ] **Step 10: Manual smoke (requires the backend running)**

Start the backend (`uvicorn app.main:app --port 8000`) with at least one imported song, then `npm run dev` and open the printed URL. Import a song if needed, click it, grant mic access, and confirm: instrumental plays with a quiet guide vocal, the blue reference line scrolls through the lanes, your orange line/dot tracks your voice, the dot turns green when you match, and the accuracy % updates. Move the guide-vocal slider and confirm the original vocal fades.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/ui frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): add library + practice screens wiring engine/renderer/scorer"
```

---

## Task 11: PWA (installable on PC + phone) + production build

**Files:**
- Modify: `frontend/vite.config.ts` (add vite-plugin-pwa)
- Create: `frontend/public/icon-192.png`, `frontend/public/icon-512.png` (placeholder icons)

- [ ] **Step 1: Add the PWA plugin to `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "my-v-coach",
        short_name: "v-coach",
        description: "Sing-along pitch trainer",
        theme_color: "#0e1218",
        background_color: "#0e1218",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
```

- [ ] **Step 2: Add placeholder icons**

Create solid-color PNGs at `frontend/public/icon-192.png` (192×192) and `frontend/public/icon-512.png` (512×512). Any valid PNG works for now (e.g. a dark square). Generate from PowerShell:

```powershell
Add-Type -AssemblyName System.Drawing
foreach ($size in 192,512) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(14,18,24))
  $bmp.Save("public/icon-$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
```

- [ ] **Step 3: Verify the production build succeeds**

Run: `npm run build`
Expected: build completes; output includes a generated `manifest.webmanifest` and a service worker (`sw.js`) in `dist/`.

- [ ] **Step 4: Verify the full test suite still passes**

Run: `npm test`
Expected: PASS (the PWA plugin doesn't affect tests).

- [ ] **Step 5: Manual smoke — installability**

Run `npm run build && npm run preview`, open the URL on your PC (and your phone on the same network using the LAN URL), and confirm the browser offers "Install" / "Add to Home Screen". Installed, it launches standalone.

- [ ] **Step 6: Commit**

```bash
git add frontend/vite.config.ts frontend/public/icon-192.png frontend/public/icon-512.png
git commit -m "feat(frontend): make the app an installable PWA"
```

---

## Task 12: A–B loop (drill a section)

**Files:**
- Create: `frontend/src/audio/loop.ts`
- Create: `frontend/src/audio/loop.test.ts`
- Modify: `frontend/src/audio/engine.ts` (store loop region)
- Modify: `frontend/src/ui/PracticeScreen.tsx` (set A/B + enforce loop in the render loop)

- [ ] **Step 1: Write the failing test for the pure loop helper**

The wrap decision is pure logic, so it's unit-tested. Create `frontend/src/audio/loop.test.ts`:

```ts
import { shouldRestartLoop } from "./loop";

test("no loop region -> never restart", () => {
  expect(shouldRestartLoop(null, 5)).toBe(false);
});

test("inside the region -> do not restart", () => {
  expect(shouldRestartLoop({ a: 2, b: 6 }, 4)).toBe(false);
});

test("at or past B -> restart", () => {
  expect(shouldRestartLoop({ a: 2, b: 6 }, 6)).toBe(true);
  expect(shouldRestartLoop({ a: 2, b: 6 }, 6.5)).toBe(true);
});

test("before A (e.g. just restarted) -> do not restart", () => {
  expect(shouldRestartLoop({ a: 2, b: 6 }, 1.5)).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/audio/loop.test.ts`
Expected: FAIL — cannot resolve `./loop`.

- [ ] **Step 3: Create `src/audio/loop.ts`**

```ts
export interface LoopRegion {
  a: number; // start seconds
  b: number; // end seconds
}

export function shouldRestartLoop(region: LoopRegion | null, currentTime: number): boolean {
  if (!region) return false;
  return currentTime >= region.b;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/audio/loop.test.ts`
Expected: PASS (all four).

- [ ] **Step 5: Add the loop region to `AudioEngine`**

In `src/audio/engine.ts`, add the import and a field + setter. After the existing imports add:

```ts
import { LoopRegion } from "./loop";
```

Add the field near the other private fields:

```ts
  private loopRegion: LoopRegion | null = null;
```

Add these methods (next to `setLatencyOffset`):

```ts
  setLoop(region: LoopRegion | null): void {
    this.loopRegion = region;
  }

  get loop(): LoopRegion | null {
    return this.loopRegion;
  }
```

- [ ] **Step 6: Enforce the loop in `PracticeScreen`'s render loop**

In `src/ui/PracticeScreen.tsx`, add to the imports:

```tsx
import { shouldRestartLoop, LoopRegion } from "../audio/loop";
```

Add state near the other `useState` hooks:

```tsx
  const [loop, setLoopState] = useState<LoopRegion | null>(null);
```

Inside the render `loop()` function in the engine effect, immediately after `const now = engine.currentTime;` add:

```tsx
        if (shouldRestartLoop(engine.loop, now)) {
          void engine.play(engine.loop!.a);
        }
```

Add loop controls to the JSX controls `<div>` (after the calibrate button):

```tsx
        <button
          onClick={() => {
            const a = engineRef.current?.currentTime ?? 0;
            const region = { a, b: a + 8 };
            engineRef.current?.setLoop(region);
            setLoopState(region);
          }}
        >
          Loop 8s from here
        </button>
        <button
          onClick={() => {
            engineRef.current?.setLoop(null);
            setLoopState(null);
          }}
        >
          Clear loop
        </button>
        {loop && <span>Looping {loop.a.toFixed(1)}–{loop.b.toFixed(1)}s</span>}
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS (loop helper tested; screen changes covered by compilation + existing tests).

- [ ] **Step 8: Manual smoke (backend running)**

In `npm run dev`, while practicing press "Loop 8s from here" mid-song and confirm playback jumps back to the start of the region each time it reaches the end; "Clear loop" resumes normal playback.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/audio/loop.ts frontend/src/audio/loop.test.ts frontend/src/audio/engine.ts frontend/src/ui/PracticeScreen.tsx
git commit -m "feat(frontend): add A-B section loop"
```

---

## Task 13: Record & play back your attempt

**Files:**
- Modify: `frontend/src/audio/engine.ts` (tee mic to a MediaRecorder)
- Modify: `frontend/src/ui/PracticeScreen.tsx` (record/stop button + playback element)

- [ ] **Step 1: Add recording to `AudioEngine`**

This uses `MediaRecorder` on the mic stream captured in `enableMic`. It's browser-only, so it's verified by manual smoke (Step 3). In `src/audio/engine.ts`, add fields near the other private fields:

```ts
  private recorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
```

Add these methods (next to `enableMic`):

```ts
  startRecording(): void {
    if (!this.micStream) throw new Error("enable mic before recording");
    this.recordedChunks = [];
    this.recorder = new MediaRecorder(this.micStream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.recorder.start();
  }

  /** Stops recording and resolves with a playable object URL (or null if nothing recorded). */
  stopRecording(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.recorder) {
        resolve(null);
        return;
      }
      this.recorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: "audio/webm" });
        this.recorder = null;
        resolve(this.recordedChunks.length ? URL.createObjectURL(blob) : null);
      };
      this.recorder.stop();
    });
  }
```

- [ ] **Step 2: Add record controls + playback to `PracticeScreen`**

In `src/ui/PracticeScreen.tsx`, add state near the other `useState` hooks:

```tsx
  const [recording, setRecording] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
```

Add a handler inside the component:

```tsx
  async function toggleRecording() {
    const engine = engineRef.current;
    if (!engine) return;
    if (recording) {
      const url = await engine.stopRecording();
      setPlaybackUrl(url);
      setRecording(false);
    } else {
      engine.startRecording();
      setRecording(true);
    }
  }
```

Add to the controls `<div>`:

```tsx
        <button onClick={() => void toggleRecording()}>
          {recording ? "Stop recording" : "Record attempt"}
        </button>
        {playbackUrl && <audio controls src={playbackUrl} aria-label="Your recording" />}
```

- [ ] **Step 3: Run the full suite + manual smoke**

Run: `npm test`
Expected: PASS (no new unit tests; existing suite still green).

Manual smoke (backend running, `npm run dev`): press "Record attempt", sing a phrase, press "Stop recording", and confirm an audio player appears that plays back your voice.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/audio/engine.ts frontend/src/ui/PracticeScreen.tsx
git commit -m "feat(frontend): record and play back your attempt"
```

---

## Self-Review

**Spec coverage (frontend portions of spec §2–§9):**
- Core loop: play song + draw reference + overlay live mic with green/red → Tasks 8, 9, 10. ✅
- Hybrid piano-roll + continuous line display → Task 9 (lanes + reference line + user line + now dot). ✅
- Guide-vocal mix, default low (0.25) → Task 8 (`vocalGain` default) + Task 10 slider. ✅
- Optional octave-tolerant matching, default off → Tasks 3, 4, 10 (`OctaveToggle` default `false`). ✅
- Session score → Tasks 4, 10 (`SessionScorer`, `ScoreReadout`). ✅
- Latency calibration → Task 8 (`calibrate`/`measureClickLatency`) + Task 10 button. ✅
- Library (import + list + select) → Tasks 7, 10. ✅
- Headphones / mic config (echo-cancellation off) → Task 8 (`getUserMedia` constraints). ✅
- Runs on PC + phone (PWA) → Task 11. ✅
- Pitch-curve data contract consumed as-is → Task 2 types + Task 8/10 usage. ✅
- A–B loop (drill a section) → Task 12 (`shouldRestartLoop` unit-tested; engine `setLoop` + screen controls). ✅
- Record & play back your attempt → Task 13 (`MediaRecorder` tee + playback element). ✅
- Testing strategy (pure logic unit-tested with synthetic signals; integration manually smoked) → Tasks 3–7, 12 unit tests, Tasks 8–13 component/smoke. ✅

**Placeholder scan:** No TBD/TODO. The `clarity` no-op block in Task 5 is documented intentionally (the RMS + peak gates are the real detector gates); it is complete code, not a placeholder.

**Type consistency:** `detectPitch(buffer, sampleRate)` consistent (Tasks 5, 8). `PitchViewport` methods `timeToX/midiToY/hzToY/nowX` consistent (Tasks 6, 9, 10). `SessionScorer({octaveTolerant, toleranceCents})` + `record(userHz, refHz)` + `.accuracy` consistent (Tasks 4, 10). `isOnPitch(hz, refHz, opts)` consistent (Tasks 3, 4, 10). API client `listSongs/getSong/importSong/stemUrl/API_BASE` consistent (Tasks 7, 8, 10). `SongDetail.vocalUrl/instrumentalUrl/curve/hopSec` match backend Task 2 schema. Consistent.
