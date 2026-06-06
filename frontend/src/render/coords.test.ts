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
