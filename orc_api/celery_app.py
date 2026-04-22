"""Celery application configuration for ORC-OS background jobs."""

import os
import time

from celery import Celery
from celery.signals import beat_init

from orc_api import INCOMING_DIRECTORY

CELERY_BROKER_URL = os.getenv("ORC_CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("ORC_CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
CELERY_TIMEZONE = os.getenv("ORC_CELERY_TIMEZONE", "UTC")

# Keep these configurable so deployment can tune schedule frequencies without code changes.

celery_app = Celery(
    "orc_api",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["orc_api.celery_tasks"],  # all tasks must be defined here
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=CELERY_TIMEZONE,
    # Route tasks by workload so heavy video jobs do not block periodic maintenance.
    task_default_queue="sync",
    task_routes={
        "orc_api.tasks.run_video": {"queue": "video"},
        "orc_api.tasks.sync_video": {"queue": "sync"},
        "orc_api.tasks.sync_videos_batch": {"queue": "sync"},
        "orc_api.tasks.run_water_level_job": {"queue": "periodic"},
        "orc_api.tasks.check_new_videos": {"queue": "periodic"},
        "orc_api.tasks.run_disk_maintenance_job": {"queue": "periodic"},
    },
)


def _build_beat_schedule() -> dict:
    """Build beat schedule entries from database settings."""
    from orc_api import crud
    from orc_api.database import get_session
    from orc_api.schemas.settings import SettingsResponse

    beat_schedule = {}
    start_time = time.time()
    with get_session() as session:
        # Only set up beat schedule if the settings are adequate
        wl_settings = crud.water_level.get(session)
        settings = crud.settings.get(session)
        dm_settings = crud.disk_management.get(session)

        if not wl_settings:
            print("Skipping water level job: no water level settings found.")
        elif not wl_settings.enabled:
            print("Skipping water level job: water level collection is disabled.")
        else:
            print(f"Adding scheduler for water level job with frequency: {wl_settings.frequency}")
            beat_schedule["run-water-level-job"] = {
                "task": "orc_api.tasks.run_water_level_job",
                "schedule": wl_settings.frequency,
                "args": (),
                "options": {"queue": "periodic", "expires": wl_settings.frequency - 2},
            }
        if not dm_settings:
            print("Skipping disk maintenance job: no disk management settings found.")
        else:
            print(f"Adding scheduler for disk management job with frequency: {dm_settings.frequency}")
            beat_schedule["run-disk-maintenance-job"] = {
                "task": "orc_api.tasks.run_disk_maintenance_job",
                "schedule": dm_settings.frequency,
                "args": (),
                "options": {"queue": "periodic", "expires": dm_settings.frequency - 2},
            }
        if settings and dm_settings:
            if settings.active:
                # validate the settings model instance
                settings = SettingsResponse.model_validate(settings)
                print(
                    f'Daemon settings found: setting up interval job "video_check_job" with path: {INCOMING_DIRECTORY} '
                    f"and file template: {settings.video_file_fmt}"
                )
                beat_schedule["video_check_job"] = {
                    "task": "orc_api.tasks.check_new_videos",
                    "schedule": 5,
                    "args": (INCOMING_DIRECTORY, settings.model_dump(mode="dict"), start_time),
                    "options": {"queue": "periodic", "expires": 30},
                }
            else:
                # settings found but not yet activated
                print("Daemon settings found, but not activated. Activate the daemon for automated processing.")
        else:
            print("No daemon settings available, ORC-OS will run interactively only.")
    return beat_schedule


def _dispatch_startup_tasks(app, beat_schedule: dict) -> None:
    """Dispatch one immediate run for each configured periodic task."""
    for entry_name, entry in beat_schedule.items():
        task_name = entry["task"]
        args = entry.get("args", ())
        kwargs = entry.get("kwargs", {})
        options = dict(entry.get("options", {}))
        app.send_task(task_name, args=args, kwargs=kwargs, **options)
        print(f"Dispatched startup run for {entry_name} ({task_name}).")


@beat_init.connect
def configure_beat_schedule(sender, **kwargs):
    """Build the beat schedule from DB settings at beat-startup time.

    This signal fires only when `celery beat` starts, so no unnecessary DB access or schedule configuration
    in the main FastAPI application.
    """
    beat_schedule = _build_beat_schedule()

    app = getattr(sender, "app", sender)
    app.conf.beat_schedule = beat_schedule

    # In some Celery boot paths beat_init runs after the scheduler object already exists.
    # Update it directly so newly loaded DB settings take effect immediately.
    scheduler = getattr(sender, "scheduler", None)
    if scheduler is not None:
        scheduler.update_from_dict(beat_schedule)
        scheduler.sync()
    # Immediately dispatch one run for each periodic task so that maintenance tasks run at startup
    _dispatch_startup_tasks(app, beat_schedule)
