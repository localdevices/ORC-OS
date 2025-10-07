"""Scheduler functions that run as background processes."""

import asyncio
from datetime import datetime, timedelta

from orc_api import INCOMING_DIRECTORY, UPLOAD_DIRECTORY, crud
from orc_api.schemas.disk_management import DiskManagementResponse
from orc_api.schemas.settings import SettingsResponse


def async_job_wrapper(func, kwargs):
    """Wrap call to async functions synchronously, needed for scheduler."""
    asyncio.run(func(**kwargs))  # Run the async function in the event loop


def get_water_level(logger):
    """Get dummy water level for testing the APScheduler API."""
    logger.info(f"Getting water level in daemon mode {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


def schedule_water_level(scheduler, logger, session):
    """Schedule the water level job."""
    # with get_session() as session:
    wl_settings = crud.water_level.get(session)
    if wl_settings:
        logger.info('Water level settings found: setting up interval job "water_level_job"')
        scheduler.add_job(
            func=wl_settings.get_new,
            trigger="interval",
            seconds=wl_settings.frequency,
            start_date=datetime.now() + timedelta(seconds=1),
            id="water_level_job",
            replace_existing=True,
        )
    else:
        logger.info("No water level settings available. If you require water level retrievals, please set this up.")


def schedule_disk_maintenance(scheduler, logger, session):
    """Schedule the disk maintenance."""
    # with get_session() as session:
    dm = crud.disk_management.get(session)
    if dm:
        # validate the settings model instance
        dm_settings = DiskManagementResponse.model_validate(dm)
        logger.info('Disk management settings found: setting up interval job "disk_managemement_job"')
        scheduler.add_job(
            func=dm_settings.cleanup,
            kwargs={"home_folder": UPLOAD_DIRECTORY},
            trigger="interval",
            seconds=dm_settings.frequency,
            start_date=datetime.now() + timedelta(seconds=5),
            id="disk_managemement_job",
            replace_existing=True,
        )
    else:
        logger.warning(
            "No disk management settings available. This is risky as your disk may run full and render access to the "
            "OS impossible."
        )


def schedule_video_checker(scheduler, logger, session, app):
    """Set up check for new videos (runs default every 5 seconds)."""
    # with get_session() as session:
    settings = crud.settings.get(session)
    dm = crud.disk_management.get(session)

    process_queue_videos = True
    # settings must be provided AND active
    if settings and dm:
        if settings.active:
            if settings.shutdown_after_task:
                # prevent that older videos are being processed
                process_queue_videos = False
            # validate the settings model instance
            settings = SettingsResponse.model_validate(settings)
            logger.info(
                f'Daemon settings found: setting up interval job "video_check_job" with path: {INCOMING_DIRECTORY} '
                f"and file template: {settings.video_file_fmt}"
            )
            scheduler.add_job(
                func=async_job_wrapper,
                kwargs={
                    "func": settings.check_new_videos,
                    "kwargs": {"path_incoming": INCOMING_DIRECTORY, "app": app, "logger": logger},
                },
                trigger="interval",
                seconds=5,
                start_date=datetime.now(),
                id="video_check_job",
                replace_existing=True,
            )
        else:
            # settings found but not yet activated
            logger.info("Daemon settings found, but not activated. Activate the daemon for automated processing.")
    else:
        logger.info("No daemon settings available, ORC-OS will run interactively only.")
    return process_queue_videos
