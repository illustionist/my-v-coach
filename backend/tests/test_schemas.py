from app.models.schemas import PitchFrame, PitchCurve, SongSummary


def test_pitch_curve_serializes_with_camelcase_keys():
    curve = PitchCurve(
        song_id="abc123",
        title="Song Name",
        duration_sec=2.0,
        hop_sec=0.01,
        frames=[PitchFrame(t=0.5, hz=220.0, conf=0.93)],
    )
    data = curve.model_dump(by_alias=True)
    assert data["songId"] == "abc123"
    assert data["durationSec"] == 2.0
    assert data["hopSec"] == 0.01
    assert data["frames"][0] == {"t": 0.5, "hz": 220.0, "conf": 0.93}


def test_song_summary_round_trips():
    s = SongSummary(id="abc123", title="Song Name", duration_sec=212.4)
    data = s.model_dump(by_alias=True)
    assert data == {"id": "abc123", "title": "Song Name", "durationSec": 212.4}
