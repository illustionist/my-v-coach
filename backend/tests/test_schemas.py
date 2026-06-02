from app.models.schemas import PitchFrame, PitchCurve, SongSummary, SongDetail


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


def test_song_detail_serializes_with_nested_curve():
    detail = SongDetail(
        id="abc123",
        title="Song Name",
        duration_sec=2.0,
        hop_sec=0.01,
        vocal_url="/songs/abc123/stems/vocal",
        instrumental_url="/songs/abc123/stems/instrumental",
        curve=PitchCurve(
            song_id="abc123",
            title="Song Name",
            duration_sec=2.0,
            hop_sec=0.01,
            frames=[PitchFrame(t=0.0, hz=440.0, conf=0.9)],
        ),
    )
    data = detail.model_dump(by_alias=True)
    assert data["vocalUrl"] == "/songs/abc123/stems/vocal"
    assert data["instrumentalUrl"] == "/songs/abc123/stems/instrumental"
    assert data["durationSec"] == 2.0
    assert data["hopSec"] == 0.01
    assert data["curve"]["songId"] == "abc123"
    assert data["curve"]["frames"][0] == {"t": 0.0, "hz": 440.0, "conf": 0.9}
