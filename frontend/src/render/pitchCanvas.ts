import { PitchCurve } from "../api/types";
import { PitchViewport } from "./coords";

export interface UserPoint {
  t: number;
  hz: number;
}

export interface DrawOptions {
  currentTime: number;
  curve: PitchCurve;
  userTrail: UserPoint[];
  userOnPitch: boolean;
}

const COLOR_REF = "#3b82f6";
const COLOR_USER = "#f59e0b";
const COLOR_ON = "#22c55e";
const COLOR_LANE = "#161b24";

export function drawPitchView(
  ctx: CanvasRenderingContext2D,
  vp: PitchViewport,
  opts: DrawOptions,
): void {
  const { widthPx, heightPx, minMidi, maxMidi } = vp.cfg;
  ctx.clearRect(0, 0, widthPx, heightPx);

  // Note lanes (alternate shading).
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    if (midi % 2 === 0) continue;
    const y = vp.midiToY(midi);
    ctx.fillStyle = COLOR_LANE;
    ctx.fillRect(0, y - heightPx / (maxMidi - minMidi) / 2, widthPx, heightPx / (maxMidi - minMidi));
  }

  // Reference pitch line (skip unvoiced frames).
  ctx.strokeStyle = COLOR_REF;
  ctx.lineWidth = 2.5;
  drawCurve(ctx, vp, opts.curve, opts.currentTime);

  // User trail.
  ctx.strokeStyle = COLOR_USER;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for (const p of opts.userTrail) {
    if (p.hz <= 0) {
      started = false;
      continue;
    }
    const x = vp.timeToX(p.t, opts.currentTime);
    const y = vp.hzToY(p.hz);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Now line.
  ctx.strokeStyle = COLOR_USER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(vp.nowX, 0);
  ctx.lineTo(vp.nowX, heightPx);
  ctx.stroke();

  // Live dot at the now line, colored by on-pitch state.
  const last = [...opts.userTrail].reverse().find((p) => p.hz > 0);
  if (last) {
    ctx.fillStyle = opts.userOnPitch ? COLOR_ON : COLOR_USER;
    ctx.beginPath();
    ctx.arc(vp.nowX, vp.hzToY(last.hz), 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  vp: PitchViewport,
  curve: PitchCurve,
  currentTime: number,
): void {
  ctx.beginPath();
  let started = false;
  for (const f of curve.frames) {
    if (f.hz <= 0) {
      started = false;
      continue;
    }
    const x = vp.timeToX(f.t, currentTime);
    const y = vp.hzToY(f.hz);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}
