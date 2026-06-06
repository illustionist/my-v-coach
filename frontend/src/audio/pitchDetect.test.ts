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
