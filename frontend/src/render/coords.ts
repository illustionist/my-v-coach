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
