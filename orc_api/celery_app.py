"""Celery application configuration for ORC-OS background jobs."""

import os

from celery import Celery
from celery.signals import beat_init

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
)


@beat_init.connect
def configure_beat_schedule(sender, **kwargs):
    """Build the beat schedule from DB settings at beat-startup time.

    This signal fires only when `celery beat` starts, so no unnecessary DB access or schedule configuration
    in the main FastAPI application.
    """
    from orc_api import crud
    from orc_api.database import get_session

    beat_schedule = {}

    with get_session() as session:
        # Only set up beat schedule if we can access settings, otherwise beat will fail to start.
        wl_settings = crud.water_level.get(session)
        if not wl_settings:
            print("Skipping water level job: no water level settings found.")
        elif not wl_settings.enabled:
            print("Skipping water level job: water level collection is disabled.")
        else:
            beat_schedule["run-water-level-job"] = {
                "task": "orc_api.tasks.run_water_level_job",
                "schedule": wl_settings.frequency,
                "args": (),
            }
        dm_settings = crud.disk_management.get(session)
        if not dm_settings:
            print("Skipping disk maintenance job: no disk management settings found.")
        else:
            beat_schedule["run-disk-maintenance-job"] = {
                "task": "orc_api.tasks.run_disk_maintenance_job",
                "schedule": dm_settings.frequency,
                "args": (),
            }

    sender.conf.beat_schedule = beat_schedule
