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
  const semis = 12 * Math.log2(hz / refHz);
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
