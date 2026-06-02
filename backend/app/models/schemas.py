from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PitchFrame(BaseModel):
    t: float
    hz: float
    conf: float


class PitchCurve(CamelModel):
    song_id: str
    title: str
    duration_sec: float
    hop_sec: float
    frames: list[PitchFrame]


class SongSummary(CamelModel):
    id: str
    title: str
    duration_sec: float


class SongDetail(CamelModel):
    id: str
    title: str
    duration_sec: float
    hop_sec: float
    vocal_url: str
    instrumental_url: str
    curve: PitchCurve
