import { vi, afterEach } from "vitest";
import { AudioEngine } from "./engine";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
