import { SessionScorer } from "./scorer";

test("accuracy is 0 before any frames recorded", () => {
  const s = new SessionScorer();
  expect(s.accuracy).toBe(0);
});

test("perfect singing scores 100%", () => {
  const s = new SessionScorer({ toleranceCents: 50 });
  for (let i = 0; i < 10; i++) s.record(440, 440);
  expect(s.accuracy).toBe(100);
});

test("frames with no reference pitch are ignored", () => {
  const s = new SessionScorer();
  s.record(440, 440); // counts, on pitch
  s.record(440, 0); // ref unvoiced -> ignored
  expect(s.total).toBe(1);
  expect(s.accuracy).toBe(100);
});

test("half on / half off scores 50%", () => {
  const s = new SessionScorer({ toleranceCents: 50 });
  s.record(440, 440); // on
  s.record(466.16, 440); // +1 semitone -> off
  expect(s.accuracy).toBe(50);
});

test("octave-tolerant mode counts an octave-up match", () => {
  const off = new SessionScorer({ octaveTolerant: false });
  off.record(880, 440);
  expect(off.accuracy).toBe(0);

  const on = new SessionScorer({ octaveTolerant: true });
  on.record(880, 440);
  expect(on.accuracy).toBe(100);
});
