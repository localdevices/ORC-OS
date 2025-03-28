from datetime import datetime, timedelta

from orc_api import db
from orc_api.crud import video as crud_video


def test_video_add(session_water_levels, vid_file, monkeypatch):
    # patch the database
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_water_levels)
    video = db.Video(
        file=vid_file,
        # timestamp=datetime.now()
    )
    video = crud_video.create(session_water_levels, video)
    # test if video has a water level attached
    assert video.time_series_id == 5  # should be the middle time stamp
    assert video.id == 1
    # link vice-versa should also appear
    ts = video.time_series
    assert ts.video == video


def test_video_add_no_water_level_found(session_water_levels, vid_file, monkeypatch):
    # patch the database
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_water_levels)
    # give a timestamp too far before the first available time stamp time series
    timestamp = datetime.now() + timedelta(hours=-24)
    video = db.Video(file=vid_file, timestamp=timestamp)
    video = crud_video.create(session_water_levels, video)
    # test if video has a water level attached
    assert video.id == 1
    assert video.time_series_id is None
    assert video.time_series is None


def test_video_add_water_level_post_video(session_video, monkeypatch):
    timestamp = datetime.now()
    h = 94.0
    ts_instance = db.TimeSeries(
        timestamp=timestamp,
        h=h,
    )
    session_video.add(ts_instance)
    session_video.commit()
    session_video.refresh(ts_instance)
    assert ts_instance.video.id == 1


def test_video_add_water_level_post_video_large_timediff(session_video, monkeypatch):
    timestamp = datetime.now() + timedelta(hours=-24)  # beyond the available video time stamp
    h = 94.0
    ts_instance = db.TimeSeries(
        timestamp=timestamp,
        h=h,
    )
    session_video.add(ts_instance)
    session_video.commit()
    session_video.refresh(ts_instance)
    assert ts_instance.video is None
