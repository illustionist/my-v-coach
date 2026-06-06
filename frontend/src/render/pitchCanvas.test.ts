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
