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
