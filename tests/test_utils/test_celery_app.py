from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from orc_api.celery_app import celery_app, configure_beat_schedule


@pytest.fixture
def session_context() -> MagicMock:
    db_session = MagicMock()
    context = MagicMock()
    context.__enter__.return_value = db_session
    context.__exit__.return_value = False
    return context


def test_task_routes_are_configured_per_workload():
    routes = celery_app.conf.task_routes

    assert celery_app.conf.task_default_queue == "sync"
    assert routes["orc_api.tasks.run_video"]["queue"] == "video"
    assert routes["orc_api.tasks.sync_video"]["queue"] == "sync"
    assert routes["orc_api.tasks.sync_videos_batch"]["queue"] == "sync"
    assert routes["orc_api.tasks.run_water_level_job"]["queue"] == "periodic"
    assert routes["orc_api.tasks.run_disk_maintenance_job"]["queue"] == "periodic"


def test_configure_beat_schedule_supports_service_sender(mocker, session_context):
    mocker.patch("orc_api.database.get_session", return_value=session_context)
    mocker.patch("orc_api.crud.water_level.get", return_value=SimpleNamespace(enabled=True, frequency=60))
    mocker.patch("orc_api.crud.disk_management.get", return_value=SimpleNamespace(frequency=120))
    mocker.patch(
        "orc_api.crud.settings.get",
        return_value=SimpleNamespace(
            id=1,
            created_at=datetime(2000, 1, 1, 0, 0, 0),
            active=True,
            shutdown_after_task=False,
            video_file_fmt="video_{unix}.mp4",
        ),
    )

    app_mock = MagicMock()
    sender = SimpleNamespace(app=app_mock)

    configure_beat_schedule(sender=sender)

    beat_schedule = app_mock.conf.beat_schedule
    assert beat_schedule["run-water-level-job"]["options"]["queue"] == "periodic"
    assert beat_schedule["run-disk-maintenance-job"]["options"]["queue"] == "periodic"
