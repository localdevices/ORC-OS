from unittest.mock import MagicMock

from orc_api.celery_tasks import (
    check_new_videos,
    run_disk_maintenance_job,
    run_video,
    run_water_level_job,
    sync_video_task,
    sync_videos_batch,
)


def _mock_context_session(db_mock: MagicMock) -> MagicMock:
    session = MagicMock()
    session.__enter__.return_value = db_mock
    session.__exit__.return_value = False
    return session


def test_run_water_level_job_try_path(mocker):
    session = MagicMock()
    wl_settings = MagicMock(enabled=True)

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.water_level.get", return_value=wl_settings)

    result = run_water_level_job()

    assert result == {"status": "ok"}
    wl_settings.get_new.assert_called_once_with()
    session.close.assert_called_once_with()


def test_run_water_level_job_missing_settings_path(mocker):
    session = MagicMock()

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.water_level.get", return_value=None)

    result = run_water_level_job()

    assert result == {"status": "skipped", "reason": "missing_settings"}
    session.close.assert_called_once_with()


def test_run_water_level_job_disabled_path(mocker):
    session = MagicMock()
    wl_settings = MagicMock(enabled=False)

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.water_level.get", return_value=wl_settings)

    result = run_water_level_job()

    assert result == {"status": "skipped", "reason": "disabled"}
    wl_settings.get_new.assert_not_called()
    session.close.assert_called_once_with()


def test_run_disk_maintenance_job_try_path(mocker):
    session = MagicMock()
    dm = MagicMock()
    dm_settings = MagicMock()

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.disk_management.get", return_value=dm)
    mocker.patch("orc_api.celery_tasks.DiskManagementResponse.model_validate", return_value=dm_settings)

    result = run_disk_maintenance_job()

    assert result == {"status": "ok"}
    dm_settings.cleanup.assert_called_once()
    session.close.assert_called_once_with()


def test_run_disk_maintenance_job_missing_settings_path(mocker):
    session = MagicMock()
    model_validate = mocker.patch("orc_api.celery_tasks.DiskManagementResponse.model_validate")

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.crud.disk_management.get", return_value=None)

    result = run_disk_maintenance_job()

    assert result == {"status": "skipped", "reason": "missing_settings"}
    model_validate.assert_not_called()
    session.close.assert_called_once_with()


def test_check_new_videos_try_path(mocker):
    settings = MagicMock()

    model_validate = mocker.patch("orc_api.celery_tasks.SettingsResponse.model_validate", return_value=settings)
    wrapper = mocker.patch("orc_api.celery_tasks.async_job_wrapper", return_value=None)
    # check with a random path and start time, as the actual values are not relevant for this test
    result = check_new_videos(path_incoming="/incoming", settings_dict={"x": 1}, start_time=1.2)

    assert result == {"status": "ok"}
    model_validate.assert_called_once_with({"x": 1})
    wrapper.assert_called_once()


def test_check_new_videos_exception_path(mocker):
    _ = mocker.patch("orc_api.celery_tasks.logger.error")
    mocker.patch("orc_api.celery_tasks.SettingsResponse.model_validate", side_effect=RuntimeError("mocked failure"))

    result = check_new_videos(path_incoming="/incoming", settings_dict={"x": 1}, start_time=1.2)

    assert result["status"] == "error"
    # assert "Error checking for new videos" in logger_error.call_args.args[0]
    assert "Error checking for new videos" in result["message"]


def test_run_video_try_path(mocker):
    db = MagicMock()
    db.get.return_value = MagicMock()
    session = _mock_context_session(db)

    video_response = MagicMock()
    video_response.get_path.return_value = "/tmp/video_1"

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.VideoResponse.model_validate", return_value=video_response)
    mocker.patch("orc_api.celery_tasks.os.path.exists", return_value=False)

    result = run_video(video_id=1, shutdown_after_task=False)

    assert result == {"status": "ok", "video_id": 1}
    video_response.run.assert_called_once()


def test_run_video_missing_video_path(mocker):
    db = MagicMock()
    db.get.return_value = None
    session = _mock_context_session(db)

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    model_validate = mocker.patch("orc_api.celery_tasks.VideoResponse.model_validate")

    result = run_video(video_id=1, shutdown_after_task=False)

    assert result == {"status": "error", "video_id": 1, "message": "Video not found"}
    model_validate.assert_not_called()


def test_run_video_exception_path(mocker):
    mocker.patch("orc_api.celery_tasks.get_session", side_effect=RuntimeError("mocked failure"))

    result = run_video(video_id=1, shutdown_after_task=False)

    assert result["status"] == "error"
    assert result["video_id"] == 1
    assert "Error processing video" in result["message"]


def test_sync_video_task_try_path(mocker):
    db = MagicMock()
    db.get.return_value = MagicMock()
    session = _mock_context_session(db)

    video_response = MagicMock()

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    mocker.patch("orc_api.celery_tasks.VideoResponse.model_validate", return_value=video_response)

    result = sync_video_task(video_id=2, site=9, sync_file=True, sync_image=False)

    assert result == {"status": "ok", "video_id": 2, "site": 9}
    video_response.sync_remote_wrapper.assert_called_once()


def test_sync_video_task_missing_video_path(mocker):
    db = MagicMock()
    db.get.return_value = None
    session = _mock_context_session(db)

    mocker.patch("orc_api.celery_tasks.get_session", return_value=session)
    model_validate = mocker.patch("orc_api.celery_tasks.VideoResponse.model_validate")

    result = sync_video_task(video_id=2, site=9, sync_file=True, sync_image=False)

    assert result == {"status": "error", "video_id": 2, "message": "Video not found"}
    model_validate.assert_not_called()


def test_sync_video_task_exception_path(mocker):
    mocker.patch("orc_api.celery_tasks.get_session", side_effect=RuntimeError("mocked failure"))

    result = sync_video_task(video_id=2, site=9, sync_file=True, sync_image=False)

    assert result["status"] == "error"
    assert result["video_id"] == 2
    assert "Error syncing video" in result["message"]


def test_sync_videos_batch_delegates_per_video(mocker):
    sync_task = mocker.patch(
        "orc_api.celery_tasks.sync_video_task",
        side_effect=[
            {"status": "ok", "video_id": 1, "site": 3},
            {"status": "error", "video_id": 2, "message": "Error syncing video 2: mocked failure"},
        ],
    )

    result = sync_videos_batch(video_ids=[1, 2], site=3, sync_file=True, sync_image=False)

    assert result == {
        "status": "completed",
        "total": 2,
        "results": [
            {"status": "ok", "video_id": 1, "site": 3},
            {"status": "error", "video_id": 2, "message": "Error syncing video 2: mocked failure"},
        ],
    }
    assert sync_task.call_count == 2
