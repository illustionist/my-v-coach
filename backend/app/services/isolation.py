from pathlib import Path
from typing import Protocol

import numpy as np
import soundfile as sf


class StemSet:
    """Result of isolation: two mono/stereo float arrays at a common sample rate."""

    def __init__(self, vocal: np.ndarray, instrumental: np.ndarray, sr: int) -> None:
        self.vocal = vocal
        self.instrumental = instrumental
        self.sr = sr


class Isolator(Protocol):
    def separate(self, audio_path: Path) -> StemSet:
        """Split an audio file into vocal + instrumental stems."""
        ...


class StubIsolator:
    """Test double: 'vocal' is the input as-is, 'instrumental' is silence."""

    def separate(self, audio_path: Path) -> StemSet:
        audio, sr = sf.read(audio_path, dtype="float32", always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return StemSet(vocal=audio, instrumental=np.zeros_like(audio), sr=sr)


class DemucsIsolator:
    """Real separation via Demucs (htdemucs). Heavy: loads a model, uses CPU/GPU."""

    def __init__(self, model_name: str = "htdemucs") -> None:
        self.model_name = model_name

    def separate(self, audio_path: Path) -> StemSet:
        import torch
        from demucs.apply import apply_model
        from demucs.audio import AudioFile
        from demucs.pretrained import get_model

        model = get_model(self.model_name)
        model.eval()
        wav = AudioFile(audio_path).read(
            streams=0, samplerate=model.samplerate, channels=model.audio_channels
        )
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / (ref.std() + 1e-8)
        with torch.no_grad():
            sources = apply_model(model, wav[None], device="cpu")[0]
        sources = sources * ref.std() + ref.mean()

        stems = dict(zip(model.sources, sources))
        vocal = stems["vocals"].mean(0).cpu().numpy()
        others = sum(stems[s] for s in model.sources if s != "vocals")
        instrumental = others.mean(0).cpu().numpy()
        return StemSet(vocal=vocal, instrumental=instrumental, sr=model.samplerate)
