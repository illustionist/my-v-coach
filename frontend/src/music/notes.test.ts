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
