import logging
import os
from datetime import datetime
from unittest.mock import MagicMock

import pytest

from orc_api.schemas.settings import SettingsResponse


@pytest.fixture
def disable_thumbnail_listener():
    """Temporarily disable the create_thumbnail_listener event."""
    from sqlalchemy import event

    from orc_api.db.video import Video, create_thumbnail_listener

    event.remove(Video, "before_insert", create_thumbnail_listener)
    event.remove(Video, "before_update", create_thumbnail_listener)
    yield
    # re-enable the event listener
    event.listen(Video, "before_insert", create_thumbnail_listener)
    event.listen(Video, "before_update", create_thumbnail_listener)


@pytest.fixture
def mock_incoming_directory(mocker, tmpdir):
    mock_dir = os.path.join(tmpdir, "incoming")
    mocker.patch("orc_api.schemas.settings.INCOMING_DIRECTORY", mock_dir)
    return mock_dir


@pytest.fixture
def mock_tmp_directory(mocker, tmpdir):
    mock_dir = os.path.join(tmpdir, "tmp")
    mocker.patch("orc_api.schemas.settings.TMP_DIRECTORY", mock_dir)
    return mock_dir


def test_add_sample_filename_with_date_format(mock_incoming_directory):
    settings = SettingsResponse(
        id=1,
        created_at=datetime.now(),
        video_file_fmt="video_{%Y%m%d_%H%M%S}.mp4",
        parse_dates_from_file=True,
    )
    result = SettingsResponse.add_sample_filename(settings)
    current_date = datetime.now().strftime("%Y%m%d_%H%M%S")
    expected_sample_file = os.path.join(mock_incoming_directory, f"video_{current_date}.mp4")
    assert result.sample_file == expected_sample_file


def test_add_sample_filename_no_date_format(mock_incoming_directory):
    settings = SettingsResponse(
        id=1,
        created_at=datetime.now(),
        video_file_fmt="video_sample.mp4",
        parse_dates_from_file=False,
    )
    result = SettingsResponse.add_sample_filename(settings)
    expected_sample_file = os.path.join(mock_incoming_directory, "video_sample.mp4")
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
    expected_sample_file = os.path.join(mock_incoming_directory, f"video_{current_unix_timestamp}.mp4")
    assert result.sample_file == expected_sample_file


@pytest.mark.asyncio
async def test_check_new_videos_no_video(mock_incoming_directory, mocker):
    process_video_mock = mocker.patch("orc_api.utils.queue.process_video")
    settings = SettingsResponse(
        id=1,
        created_at=datetime.now(),
        video_file_fmt="video_{%Y%m%d_%H%M%S}.mp4",
        parse_dates_from_file=True,
        reboot_after=False,
    )
    await settings.check_new_videos(path_incoming=mock_incoming_directory, app=None, logger=logging)
    process_video_mock.assert_not_called()


@pytest.mark.asyncio
async def test_check_new_videos_with_video(
    session_video_config, mock_incoming_directory, mock_tmp_directory, mocker, monkeypatch, disable_thumbnail_listener
):
    def mock_create_thumbnail_listener(mapper, connection, target):
        return None

    # mock for app
    app = MagicMock()
    app.state.executor = MagicMock()
    app.state.start_time = datetime.now()

    monkeypatch.setattr("orc_api.schemas.settings.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.db.video.create_thumbnail_listener", mock_create_thumbnail_listener)
    process_video_mock = mocker.patch("orc_api.utils.queue.process_video")

    settings = SettingsResponse(
        id=1,
        created_at=datetime.now(),
        video_file_fmt="video_{%Y%m%d_%H%M%S}.mp4",
        parse_dates_from_file=True,
        reboot_after=False,
    )
    # create tmp files
    os.makedirs(mock_incoming_directory, exist_ok=True)
    os.makedirs(mock_tmp_directory, exist_ok=True)
    with open(os.path.join(mock_incoming_directory, "video_20230101_123456.mp4"), "w") as f:
        f.write("test_video_file")
    await settings.check_new_videos(path_incoming=mock_incoming_directory, app=app, logger=logging)
    process_video_mock.assert_called_once()
