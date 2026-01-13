"""Test lifespan set up of main app."""

import pytest

from orc_api.main import app, lifespan
from orc_api.utils.queue import PriorityThreadPoolExecutor


@pytest.mark.asyncio
async def test_lifespan_initializes_state(monkeypatch, mocker):
    fake_scheduler = mocker.Mock()
    mocker.patch("orc_api.main.BackgroundScheduler", return_value=fake_scheduler)
    mocker.patch("orc_api.main.schedule_disk_maintenance", return_value=None)
    mocker.patch("orc_api.main.schedule_video_checker", return_value=None)
    mocker.patch("orc_api.main.schedule_water_level", return_value=fake_scheduler)

    fake_session = mocker.Mock()
    mocker.patch("orc_api.main.get_session", return_value=fake_session)
    mocker.patch("orc_api.main.crud.video.get_list", return_value=[])

    # make delayed_sync_videos not do any operations, and pass this in create_task
    async def fake_delayed_sync_videos(app_arg, logger_arg):
        return

    mocker.patch("orc_api.main.delayed_sync_videos", fake_delayed_sync_videos)
    mocker.patch("orc_api.main.get_session", return_value=fake_session)
    mocker.patch("orc_api.main.crud.video.get_list", return_value=[])

    def sync_run_nothing(coro):
        # close coroutine to prevent "never awaited" warning.
        coro.close()
        return None

    mocker.patch("orc_api.main.asyncio.create_task", side_effect=sync_run_nothing)  # ensures awaiting

    async with lifespan(app):
        assert app.state.scheduler is fake_scheduler
        assert isinstance(app.state.executor, PriorityThreadPoolExecutor)
        assert isinstance(app.state.process_list, list)
