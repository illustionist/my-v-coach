export interface PitchFrame {
  t: number;
  hz: number;
  conf: number;
}

export interface PitchCurve {
  songId: string;
  title: string;
  durationSec: number;
  hopSec: number;
  frames: PitchFrame[];
}

export interface SongSummary {
  id: string;
  title: string;
  durationSec: number;
}

export interface SongDetail {
  id: string;
  title: string;
  durationSec: number;
  hopSec: number;
  vocalUrl: string;
  instrumentalUrl: string;
  curve: PitchCurve;
}
