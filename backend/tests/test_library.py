from app.models.schemas import PitchCurve, PitchFrame


def _curve(song_id: str) -> PitchCurve:
    return PitchCurve(
        song_id=song_id,
        title="T",
        duration_sec=1.0,
        hop_sec=0.01,
        frames=[PitchFrame(t=0.0, hz=440.0, conf=0.9)],
    )


def test_add_then_get_round_trips(tmp_library):
    record = tmp_library.add_song(
        title="My Song",
        duration_sec=1.0,
        hop_sec=0.01,
        vocal_bytes=b"VOCAL",
        instrumental_bytes=b"INSTR",
        curve=_curve("placeholder"),
    )
    fetched = tmp_library.get_song(record.id)
    assert fetched is not None
    assert fetched.title == "My Song"
    assert fetched.duration_sec == 1.0
    assert fetched.curve.song_id == record.id
    assert fetched.curve.frames[0].hz == 440.0


def test_stem_bytes_are_persisted(tmp_library):
    record = tmp_library.add_song(
        title="My Song", duration_sec=1.0, hop_sec=0.01,
        vocal_bytes=b"VOCAL", instrumental_bytes=b"INSTR", curve=_curve("x"),
    )
    assert tmp_library.read_stem(record.id, "vocal") == b"VOCAL"
    assert tmp_library.read_stem(record.id, "instrumental") == b"INSTR"


def test_list_returns_summaries(tmp_library):
    tmp_library.add_song(title="A", duration_sec=1.0, hop_sec=0.01,
                         vocal_bytes=b"v", instrumental_bytes=b"i", curve=_curve("x"))
    tmp_library.add_song(title="B", duration_sec=2.0, hop_sec=0.01,
                         vocal_bytes=b"v", instrumental_bytes=b"i", curve=_curve("y"))
    summaries = tmp_library.list_songs()
    titles = sorted(s.title for s in summaries)
    assert titles == ["A", "B"]


def test_get_missing_song_returns_none(tmp_library):
    assert tmp_library.get_song("does-not-exist") is None


def test_read_stem_rejects_unknown_kind(tmp_library):
    record = tmp_library.add_song(title="A", duration_sec=1.0, hop_sec=0.01,
                                  vocal_bytes=b"v", instrumental_bytes=b"i", curve=_curve("x"))
    import pytest
    with pytest.raises(ValueError):
        tmp_library.read_stem(record.id, "drums")
