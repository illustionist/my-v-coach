import { SongDetail } from "../api/types";
import { stemUrl } from "../api/client";
import { detectPitch } from "./pitchDetect";
import { LoopRegion } from "./loop";

export type UserPitchHandler = (hz: number, atSongTime: number) => void;

export class AudioEngine {
  private ctx: AudioContext;
  private vocalBuf: AudioBuffer | null = null;
  private instrBuf: AudioBuffer | null = null;
  private vocalGain: GainNode;
  private instrGain: GainNode;
  private vocalSrc: AudioBufferSourceNode | null = null;
  private instrSrc: AudioBufferSourceNode | null = null;

  private startCtxTime = 0; // ctx.currentTime when playback started
  private startOffset = 0; // song position playback started from
  private playing = false;
  private latencyOffsetSec = 0;

  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private loopRegion: LoopRegion | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.vocalGain = this.ctx.createGain();
    this.instrGain = this.ctx.createGain();
    this.vocalGain.connect(this.ctx.destination);
    this.instrGain.connect(this.ctx.destination);
    this.vocalGain.gain.value = 0.25; // spec default: guide vocal low
    this.instrGain.gain.value = 1.0;
  }

  async loadSong(detail: SongDetail): Promise<void> {
    const [vocal, instr] = await Promise.all([
      this.fetchBuffer(stemUrl(detail.vocalUrl)),
      this.fetchBuffer(stemUrl(detail.instrumentalUrl)),
    ]);
    this.vocalBuf = vocal;
    this.instrBuf = instr;
  }

  private async fetchBuffer(url: string): Promise<AudioBuffer> {
    const resp = await fetch(url);
    const bytes = await resp.arrayBuffer();
    return await this.ctx.decodeAudioData(bytes);
  }

  /** 0 = vocal muted (karaoke), 1 = full original vocal. */
  setGuideVocal(level: number): void {
    this.vocalGain.gain.value = Math.max(0, Math.min(1, level));
  }

  async play(fromSec = 0): Promise<void> {
    if (!this.vocalBuf || !this.instrBuf) throw new Error("no song loaded");
    await this.ctx.resume();
    this.stopSources();

    this.vocalSrc = this.ctx.createBufferSource();
    this.vocalSrc.buffer = this.vocalBuf;
    this.vocalSrc.connect(this.vocalGain);

    this.instrSrc = this.ctx.createBufferSource();
    this.instrSrc.buffer = this.instrBuf;
    this.instrSrc.connect(this.instrGain);

    this.startCtxTime = this.ctx.currentTime;
    this.startOffset = fromSec;
    this.vocalSrc.start(0, fromSec);
    this.instrSrc.start(0, fromSec);
    this.playing = true;
  }

  pause(): void {
    this.stopSources();
    this.startOffset = this.currentTime;
    this.playing = false;
  }

  private stopSources(): void {
    this.vocalSrc?.stop();
    this.instrSrc?.stop();
    this.vocalSrc = null;
    this.instrSrc = null;
  }

  /** Current song position in seconds, latency-corrected. */
  get currentTime(): number {
    if (!this.playing) return this.startOffset;
    return this.startOffset + (this.ctx.currentTime - this.startCtxTime);
  }

  setLatencyOffset(seconds: number): void {
    this.latencyOffsetSec = seconds;
  }

  setLoop(region: LoopRegion | null): void {
    this.loopRegion = region;
  }

  get loop(): LoopRegion | null {
    return this.loopRegion;
  }

  async enableMic(onPitch: UserPitchHandler): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await this.ctx.audioWorklet.addModule("/pitch-worklet.js");
    const src = this.ctx.createMediaStreamSource(this.micStream);
    this.workletNode = new AudioWorkletNode(this.ctx, "pitch-capture");
    this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const hz = detectPitch(e.data, this.ctx.sampleRate);
      // Align the moment the mic captured this frame to the song clock.
      onPitch(hz, this.currentTime - this.latencyOffsetSec);
    };
    src.connect(this.workletNode);
    // Intentionally NOT connected to destination — avoids hearing your own mic.
  }

  /**
   * Measure round-trip latency: emit a short click, listen for it on the mic,
   * and store the delay so live pitch lines up with the song. Returns the
   * measured offset in seconds.
   */
  async calibrate(): Promise<number> {
    if (!this.micStream) throw new Error("enable mic before calibrating");
    const offset = await measureClickLatency(this.ctx, this.micStream);
    this.setLatencyOffset(offset);
    return offset;
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  dispose(): void {
    this.stopSources();
    this.micStream?.getTracks().forEach((t) => t.stop());
    void this.ctx.close();
  }
}

/** Plays a 1 kHz click and times how long until the mic hears it. */
async function measureClickLatency(ctx: AudioContext, mic: MediaStream): Promise<number> {
  return new Promise<number>((resolve) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const micSrc = ctx.createMediaStreamSource(mic);
    micSrc.connect(analyser);
    const data = new Float32Array(analyser.fftSize);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 1000;
    g.gain.value = 0.5;
    osc.connect(g).connect(ctx.destination);

    const clickAt = ctx.currentTime + 0.1;
    osc.start(clickAt);
    osc.stop(clickAt + 0.05);

    const deadline = clickAt + 1.0;
    const poll = () => {
      analyser.getFloatTimeDomainData(data);
      let rms = 0;
      for (let i = 0; i < data.length; i++) rms += data[i] * data[i];
      rms = Math.sqrt(rms / data.length);
      if (rms > 0.05) {
        resolve(Math.max(0, ctx.currentTime - clickAt));
        return;
      }
      if (ctx.currentTime > deadline) {
        resolve(0); // calibration failed; assume no offset
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}
