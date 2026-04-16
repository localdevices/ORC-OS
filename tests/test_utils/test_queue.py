from datetime import datetime, timedelta
from unittest.mock import MagicMock, PropertyMock

import pytest
from fastapi import HTTPException

from orc_api.db.base import SyncStatus
from orc_api.db.video import Video, VideoStatus
from orc_api.schemas.video import VideoResponse
from orc_api.utils import queue


@pytest.fixture
def videos() -> list[Video]:
    base = datetime(2024, 1, 1, 12, 0, 0)
    return [
        Video(
            id=1,
            timestamp=base,
            file="videos/20240101/1/video_1.mp4",
            status=VideoStatus.NEW,
            sync_status=SyncStatus.LOCAL,
        ),
        Video(
            id=2,
            timestamp=base + timedelta(minutes=1),
            file="videos/20240101/2/video_2.mp4",
            status=VideoStatus.NEW,
            sync_status=SyncStatus.UPDATED,
        ),
        Video(
            id=3,
            timestamp=base + timedelta(minutes=2),
            file="videos/20240101/3/video_3.mp4",
            status=VideoStatus.NEW,
            sync_status=SyncStatus.FAILED,
        ),
    ]


@pytest.fixture
def session_mock() -> MagicMock:
    return MagicMock()


@pytest.fixture
def mock_send_task(mocker):
    return mocker.patch("orc_api.utils.queue.celery_app.send_task", return_value=None)


@pytest.mark.asyncio
async def test_process_video_success(videos, session_mock, mock_send_task, mocker):
    video_response = VideoResponse.model_validate(videos[0])
    # make sure the video looks like ready to go (actual processing is mocked)
    mocker.patch.object(VideoResponse, "ready_to_run", new_callable=PropertyMock, return_value=(True, "Ready"))
    mocker.patch("orc_api.utils.queue.crud.video.get", side_effect=lambda *_args, **_kwargs: videos[0])

    result = await queue.process_video(
        session=session_mock,
        video=video_response,
        shutdown_after_task=True,
        priority=99,
    )

    assert result.status == VideoStatus.QUEUE
    mock_send_task.assert_called_once_with(
        "orc_api.tasks.run_video",
        args=(video_response.id, True),
        priority=5,
    )
    assert session_mock.commit.called
    assert session_mock.refresh.called


@pytest.mark.asyncio
async def test_process_video_not_ready(videos, session_mock, mock_send_task, mocker):
    video_response = VideoResponse.model_validate(videos[0])
    mocker.patch.object(
        VideoResponse,
        "ready_to_run",
        new_callable=PropertyMock,
        return_value=(False, "Video is not ready."),
    )
    # this should raise a HTTPException because the video is not yet ready to run
    with pytest.raises(HTTPException) as exc:
        await queue.process_video(session=session_mock, video=video_response)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Video is not ready."
    mock_send_task.assert_not_called()


@pytest.mark.asyncio
async def test_sync_video_no_site(videos, session_mock, mock_send_task):
    # when no site is available, the video instance should be returned as is without any error, and without task
    # submission
    video_response = VideoResponse.model_validate(videos[0])
    returned = await queue.sync_video(session=session_mock, video=video_response, site=None)

    assert returned is video_response
    mock_send_task.assert_not_called()


@pytest.mark.asyncio
async def test_sync_videos_list_empty_videos_no_task(session_mock, mock_send_task):
    returned = await queue.sync_videos_list(videos=[], session=session_mock, site=77)

    assert returned == []
    mock_send_task.assert_not_called()
    session_mock.commit.assert_not_called()


@pytest.mark.asyncio
async def test_sync_videos_start_stop(videos, session_mock, mock_send_task, mocker):
    grouped = {
        SyncStatus.LOCAL: [videos[0]],
        SyncStatus.UPDATED: [videos[1]],
        SyncStatus.FAILED: [videos[2]],
    }

    def mock_get_list(*, db, start=None, stop=None, sync_status=None, **kwargs):
        del db, start, stop, kwargs
        return grouped[sync_status]

    def mock_get(_session, id):
        # mocker for crud.video.get
        return next((v for v in videos if v.id == id), None)

    mocker.patch("orc_api.utils.queue.crud.video.get_list", side_effect=mock_get_list)
    mocker.patch("orc_api.utils.queue.crud.video.get", side_effect=mock_get)

    returned = await queue.sync_videos_start_stop(
        session=session_mock,
        start=datetime(2024, 1, 1, 0, 0, 0),
        stop=datetime(2024, 1, 2, 0, 0, 0),
        site=42,
        sync_file=True,
        sync_image=False,
    )

    assert returned == videos
    assert session_mock.commit.call_count == 3
    mock_send_task.assert_called_once_with(
        "orc_api.tasks.sync_videos_batch",
        args=([1, 2, 3], 42, True, False),
    )
