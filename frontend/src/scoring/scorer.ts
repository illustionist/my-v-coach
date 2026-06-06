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
