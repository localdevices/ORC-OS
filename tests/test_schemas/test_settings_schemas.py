from datetime import datetime

import pytest

from orc_api.schemas.settings import SettingsResponse


@pytest.fixture
def mock_incoming_directory(mocker):
    mocker.patch("orc_api.schemas.settings.INCOMING_DIRECTORY", "/mock/incoming")


def test_add_sample_filename_with_date_format(mock_incoming_directory):
    settings = SettingsResponse(
        id=1,
        created_at=datetime.now(),
        video_file_fmt="video_{%Y%m%d_%H%M%S}.mp4",
        parse_dates_from_file=True,
    )

    result = SettingsResponse.add_sample_filename(settings)
    current_date = datetime.now().strftime("%Y%m%d_%H%M%S")
    expected_sample_file = f"/mock/incoming/video_{current_date}.mp4"
    assert result.sample_file == expected_sample_file


def test_add_sample_filename_no_date_format(mock_incoming_directory):
    settings = SettingsResponse(
        id=1,
        created_at=datetime.now(),
        video_file_fmt="video_sample.mp4",
        parse_dates_from_file=False,
    )
    result = SettingsResponse.add_sample_filename(settings)
    expected_sample_file = "/mock/incoming/video_sample.mp4"
    assert result.sample_file == expected_sample_file


def test_add_sample_filename_unix_timestamp(mock_incoming_directory):
    settings = SettingsResponse(
        id=1,
        created_at=datetime.now(),
        video_file_fmt="video_{unix}.mp4",
        parse_dates_from_file=True,
    )
    result = SettingsResponse.add_sample_filename(settings)
    current_unix_timestamp = str(int(datetime.now().timestamp()))
    expected_sample_file = f"/mock/incoming/video_{current_unix_timestamp}.mp4"
    assert result.sample_file == expected_sample_file
