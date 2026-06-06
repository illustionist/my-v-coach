import { shouldRestartLoop } from "./loop";

test("no loop region -> never restart", () => {
  expect(shouldRestartLoop(null, 5)).toBe(false);
});

test("inside the region -> do not restart", () => {
  expect(shouldRestartLoop({ a: 2, b: 6 }, 4)).toBe(false);
});

test("at or past B -> restart", () => {
  expect(shouldRestartLoop({ a: 2, b: 6 }, 6)).toBe(true);
  expect(shouldRestartLoop({ a: 2, b: 6 }, 6.5)).toBe(true);
});

test("before A (e.g. just restarted) -> do not restart", () => {
  expect(shouldRestartLoop({ a: 2, b: 6 }, 1.5)).toBe(false);
});
