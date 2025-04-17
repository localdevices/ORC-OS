from datetime import datetime, timedelta

from orc_api.crud import time_series
from orc_api.db import TimeSeries, WaterLevelSettings


def test_get_time_series_returns_closest_record(session_water_levels):
    # Get the previous hour time stamp
    prev_time = datetime.now() - timedelta(hours=1)
    result = time_series.get_closest(session_water_levels, prev_time)
    # Assert that the record is close to prev_time
    assert result.timestamp - prev_time < timedelta(seconds=10)


def test_get_time_series_raises_when_no_records_found(session_config):
    # Configure mocks to return None for both queries
    # Run the function and assert it returns None
    result = time_series.get_closest(session_config, datetime.now())
    assert result is None


def test_get_time_series_respects_allowed_dt(session_water_levels):
    allowed_dt = 300  # 5 minutes
    target_time = datetime.now() + timedelta(hours=5)

    # Run the function and assert it raises ValueError due to allowed_dt
    result = time_series.get_closest(session_water_levels, target_time, allowed_dt=allowed_dt)
    assert result is None


def test_get_time_series_within_allowed_dt(session_water_levels):
    allowed_dt = 300  # 5 minutes
    target_time = datetime.now() + timedelta(hours=4)
    # Run the function and assert it returns None
    result = time_series.get_closest(session_water_levels, target_time, allowed_dt=allowed_dt)
    assert abs(result.timestamp - target_time).total_seconds() < allowed_dt


def test_get_new_time_series_from_script(session_water_levels, monkeypatch):
    # there should not be any water level before 2000
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_water_levels)
    no_levels = session_water_levels.query(TimeSeries).filter(TimeSeries.timestamp < datetime(2000, 1, 2)).count()
    assert no_levels == 0
    water_level_settings = session_water_levels.query(WaterLevelSettings).first()
    water_level_settings.get_new()
    # check if the data is available, a level at date 2000-01-01 should be available
    with_levels = session_water_levels.query(TimeSeries).filter(TimeSeries.timestamp == datetime(2000, 1, 1)).count()
    assert with_levels == 1
