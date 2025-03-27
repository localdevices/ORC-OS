from datetime import datetime, timedelta

import pytest

from orc_api.crud import time_series


def test_get_water_level_returns_closest_record(session_water_levels):
    # Get the previous hour time stamp
    prev_time = datetime.now() - timedelta(hours=1)
    result = time_series.get_closest(session_water_levels, prev_time)
    # Assert that the record is close to prev_time
    assert result.timestamp - prev_time < timedelta(seconds=10)


def test_get_water_level_raises_when_no_records_found(session_config):
    # Configure mocks to return None for both queries
    # Run the function and assert it raises the proper exception
    with pytest.raises(ValueError, match="No water level entries found for timestamp"):
        time_series.get_closest(session_config, datetime.now())


def test_get_water_level_respects_allowed_dt(session_water_levels):
    allowed_dt = 300  # 5 minutes
    target_time = datetime.now() + timedelta(hours=5)

    # Run the function and assert it raises ValueError due to allowed_dt
    with pytest.raises(ValueError, match=f"No water level found within {allowed_dt} seconds"):
        time_series.get_closest(session_water_levels, target_time, allowed_dt=allowed_dt)


def test_get_water_level_within_allowed_dt(session_water_levels):
    allowed_dt = 300  # 5 minutes
    target_time = datetime.now() + timedelta(hours=4)
    # Run the function and assert it raises ValueError due to allowed_dt
    result = time_series.get_closest(session_water_levels, target_time, allowed_dt=allowed_dt)
    assert abs(result.timestamp - target_time).total_seconds() < allowed_dt
