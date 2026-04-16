from datetime import datetime
from unittest.mock import MagicMock

import pytest

from orc_api import UPLOAD_DIRECTORY
from orc_api.celery_tasks import (
    run_disk_maintenance_job,
    run_video,
    run_water_level_job,
    sync_video_task,
    sync_videos_batch,
)
from orc_api.db.base import SyncStatus
from orc_api.db.disk_management import DiskManagement
from orc_api.db.video import Video, VideoStatus
from orc_api.db.water_level_settings import ScriptType, WaterLevelSettings


@pytest.fixture
def real_video() -> Video:
    return Video(
        id=11,
        timestamp=datetime(2024, 1, 1, 12, 0, 0),
        file="videos/20240101/11/video.mp4",
        status=VideoStatus.NEW,
        sync_status=SyncStatus.LOCAL,
    )


@pytest.fixture
def water_level_settings() -> WaterLevelSettings:
    return WaterLevelSettings(
        id=3,
        created_at=datetime(2024, 1, 1, 0, 0, 0),
        enabled=True,
        frequency=600,
        script_type=ScriptType.PYTHON,
        script='print("2000-01-01T00:00:00Z, 10")',
    )


@pytest.fixture
def disk_management_settings() -> DiskManagement:
    return DiskManagement(
        id=4,
        created_at=datetime(2024, 1, 1, 0, 0, 0),
        min_free_space=20,
        critical_space=10,
        frequency=3600,
    )


def make_context_session(db_mock: MagicMock) -> MagicMock:
    session = MagicMock()
    session.__enter__.return_value = db_mock
    session.__exit__.return_value = False
    return session


def test_run_water_level_job_calls_get_new(mocker, water_level_settings):
    session = MagicMock()
    get_new_mock = mocker.patch.object(water_level_settings, "get_new", return_value=None)
    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.water_level.get", return_value=water_level_settings)

    result = run_water_level_job()

    assert result == {"status": "ok"}
    get_new_mock.assert_called_once_with()
    session.close.assert_called_once_with()


def test_run_water_level_no_settings(mocker):
    session = MagicMock()
    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.water_level.get", return_value=None)

    result = run_water_level_job()

    assert result == {"status": "skipped", "reason": "missing_settings"}
    session.close.assert_called_once_with()


def test_run_water_level_disabled(mocker, water_level_settings):
    session = MagicMock()
    water_level_settings.enabled = False
    get_new_mock = mocker.patch.object(water_level_settings, "get_new", return_value=None)
    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.water_level.get", return_value=water_level_settings)

    result = run_water_level_job()

    assert result == {"status": "skipped", "reason": "disabled"}
    get_new_mock.assert_not_called()
    session.close.assert_called_once_with()


def test_run_disk_maintenance(mocker, disk_management_settings):
    session = MagicMock()
    cleanup_mock = mocker.patch("orc_api.celery_tasks.DiskManagementResponse.cleanup", return_value=None)
    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.disk_management.get", return_value=disk_management_settings)

    result = run_disk_maintenance_job()

    assert result == {"status": "ok"}
    cleanup_mock.assert_called_once_with(home_folder=UPLOAD_DIRECTORY)
    session.close.assert_called_once_with()


def test_run_video_mocked(mocker, real_video):
    db_mock = MagicMock()
    db_mock.get.return_value = real_video
    session = make_context_session(db_mock)
    run_mock = mocker.patch("orc_api.celery_tasks.VideoResponse.run", return_value=None)
    rmtree_mock = mocker.patch("orc_api.celery_tasks.shutil.rmtree")
    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.os.path.exists", return_value=False)

    result = run_video(video_id=real_video.id, shutdown_after_task=False)

    assert result == {"status": "ok", "video_id": real_video.id}
    db_mock.get.assert_called_once_with(Video, real_video.id)
    run_mock.assert_called_once_with(UPLOAD_DIRECTORY, "", False)
    rmtree_mock.assert_not_called()


def test_sync_video_mocked(mocker, real_video):
    db_mock = MagicMock()
    db_mock.get.return_value = real_video
    session = make_context_session(db_mock)
    sync_mock = mocker.patch("orc_api.celery_tasks.VideoResponse.sync_remote_wrapper", return_value=None)
    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)

    result = sync_video_task(video_id=real_video.id, site=9, sync_file=True, sync_image=False)

    assert result == {"status": "ok", "video_id": real_video.id, "site": 9}
    db_mock.get.assert_called_once_with(Video, real_video.id)
    sync_mock.assert_called_once_with(base_path=UPLOAD_DIRECTORY, site=9, sync_file=True, sync_image=False)


def test_sync_videos_batch_mocked(mocker):
    sync_task_mock = mocker.patch(
        "orc_api.celery_tasks.sync_video_task",
        side_effect=[
            {"status": "ok", "video_id": 1, "site": 7},
            {"status": "ok", "video_id": 2, "site": 7},
        ],
    )

    result = sync_videos_batch(video_ids=[1, 2], site=7, sync_file=False, sync_image=True)

    assert result == {
        "status": "completed",
        "total": 2,
        "results": [
            {"status": "ok", "video_id": 1, "site": 7},
            {"status": "ok", "video_id": 2, "site": 7},
        ],
    }
    assert sync_task_mock.call_count == 2
    assert sync_task_mock.call_args_list[0].kwargs == {
        "video_id": 1,
        "site": 7,
        "sync_file": False,
        "sync_image": True,
    }
    assert sync_task_mock.call_args_list[1].kwargs == {
        "video_id": 2,
        "site": 7,
        "sync_file": False,
        "sync_image": True,
    }
