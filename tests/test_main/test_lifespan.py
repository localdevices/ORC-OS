"""Test lifespan set up of main app."""

import pytest

from orc_api.db.base import SyncStatus
from orc_api.db.video import Video, VideoStatus
from orc_api.main import app, lifespan


@pytest.mark.asyncio
async def test_lifespan_initializes_state(mocker):
    fake_session = mocker.Mock()
    mocker.patch("orc_api.main.get_session", return_value=fake_session)

    # Build two Video instances without hitting the DB
    fake_videos = [
        Video(
            id=i,
            file=f"video_{i}.mp4",
            timestamp=f"2024-06-0{i}T00:00:00Z",
            status=VideoStatus.NEW,
            sync_status=SyncStatus.LOCAL,
        )
        for i in range(1, 3)
    ]
    mocker.patch(
        "orc_api.utils.startup_checks.crud.video.get_list",
        return_value=fake_videos,
    )
    mocker.patch(
        "orc_api.utils.startup_checks.crud.settings.get",
        return_value=None,
    )
    # make sure the submission of jobs is bypassed
    mocker.patch("orc_api.utils.startup_checks.celery_app.send_task")

    async with lifespan(app):
        assert hasattr(app.state, "session")
