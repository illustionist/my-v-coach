import { useEffect, useRef, useState } from "react";
import { getSong } from "../api/client";
import { SongDetail } from "../api/types";
import { AudioEngine } from "../audio/engine";
import { PitchViewport } from "../render/coords";
import { drawPitchView, UserPoint } from "../render/pitchCanvas";
import { SessionScorer } from "../scoring/scorer";
import { isOnPitch } from "../music/notes";
import { GuideVocalSlider } from "./components/GuideVocalSlider";
import { OctaveToggle } from "./components/OctaveToggle";
import { ScoreReadout } from "./components/ScoreReadout";

const WIDTH = 800;
const HEIGHT = 400;

export function PracticeScreen({ songId, onBack }: { songId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<SongDetail | null>(null);
  const [guideVocal, setGuideVocal] = useState(0.25);
  const [octaveTolerant, setOctaveTolerant] = useState(false);
  const [accuracy, setAccuracy] = useState(0);

  const engineRef = useRef<AudioEngine | null>(null);
  const scorerRef = useRef(new SessionScorer({ octaveTolerant: false }));
  const trailRef = useRef<UserPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load the song detail.
  useEffect(() => {
    getSong(songId).then(setDetail).catch(console.error);
  }, [songId]);

  // Keep scorer option in sync with the toggle.
  useEffect(() => {
    scorerRef.current = new SessionScorer({ octaveTolerant });
    setAccuracy(0);
  }, [octaveTolerant]);

  // Set up the engine + render loop once the song is loaded.
  useEffect(() => {
    if (!detail) return;
    const engine = new AudioEngine();
    engineRef.current = engine;
    const vp = new PitchViewport({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      nowXFrac: 0.5,
      pxPerSecond: 100,
      minMidi: 48,
      maxMidi: 84,
    });

    let raf = 0;
    let cancelled = false;

    function refHzAt(t: number): number {
      if (!detail) return 0;
      const idx = Math.round(t / detail.hopSec);
      const frame = detail.curve.frames[idx];
      return frame ? frame.hz : 0;
    }

    (async () => {
      await engine.loadSong(detail);
      engine.setGuideVocal(guideVocal);
      await engine.enableMic((hz, atTime) => {
        trailRef.current.push({ t: atTime, hz });
        if (trailRef.current.length > 600) trailRef.current.shift();
        const ref = refHzAt(atTime);
        scorerRef.current.record(hz, ref);
        setAccuracy(scorerRef.current.accuracy);
      });
      await engine.play(0);

      const ctx = canvasRef.current?.getContext("2d");
      const loop = () => {
        if (cancelled || !ctx) return;
        const now = engine.currentTime;
        const last = [...trailRef.current].reverse().find((p) => p.hz > 0);
        const onPitch = last ? isOnPitch(last.hz, refHzAt(now), { octaveTolerant }) : false;
        drawPitchView(ctx, vp, {
          currentTime: now,
          curve: detail.curve,
          userTrail: trailRef.current,
          userOnPitch: onPitch,
        });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })().catch(console.error);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      engine.dispose();
    };
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  function onGuideVocal(v: number) {
    setGuideVocal(v);
    engineRef.current?.setGuideVocal(v);
  }

  return (
    <div>
      <button onClick={onBack}>← Library</button>
      <h2>{detail?.title ?? "Loading…"}</h2>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ background: "#0e1218" }} />
      <div>
        <GuideVocalSlider value={guideVocal} onChange={onGuideVocal} />
        <OctaveToggle checked={octaveTolerant} onChange={setOctaveTolerant} />
        <ScoreReadout accuracy={accuracy} />
        <button onClick={() => engineRef.current?.calibrate()}>Calibrate latency</button>
      </div>
    </div>
  );
}
