import librosa
import numpy as np

from app.models.schemas import PitchFrame


def analyze_pitch(audio: np.ndarray, sr: int, hop_sec: float = 0.01) -> list[PitchFrame]:
    """Estimate the fundamental frequency over time using probabilistic YIN.

    Returns one frame per hop. `hz == 0.0` marks unvoiced/silent frames.
    """
    hop_length = max(1, int(round(sr * hop_sec)))
    f0, _voiced_flag, voiced_prob = librosa.pyin(
        audio,
        sr=sr,
        fmin=float(librosa.note_to_hz("C2")),
        fmax=float(librosa.note_to_hz("C7")),
        hop_length=hop_length,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)

    frames: list[PitchFrame] = []
    for t, hz, prob in zip(times, f0, voiced_prob):
        voiced = hz is not None and not np.isnan(hz)
        hz_val = float(hz) if voiced else 0.0
        conf = float(prob) if (prob is not None and not np.isnan(prob)) else 0.0
        frames.append(
            PitchFrame(
                t=round(float(t), 3),
                hz=round(hz_val, 2),
                conf=round(conf if voiced else 0.0, 2),
            )
        )
    return frames
