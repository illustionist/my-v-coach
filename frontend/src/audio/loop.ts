export interface LoopRegion {
  a: number; // start seconds
  b: number; // end seconds
}

export function shouldRestartLoop(region: LoopRegion | null, currentTime: number): boolean {
  if (!region) return false;
  return currentTime >= region.b;
}
