"""Recurring Celery tasks for ORC-OS."""

import os
import shutil

from orc_api import UPLOAD_DIRECTORY, crud
from orc_api.celery_app import celery_app
from orc_api.database import get_session
from orc_api.db.video import Video
from orc_api.log import logger
from orc_api.schemas.disk_management import DiskManagementResponse
from orc_api.schemas.video import VideoResponse


@celery_app.task(name="orc_api.tasks.run_water_level_job")
def run_water_level_job() -> dict:
    """Run water level retrieval when enabled in settings."""
    session = get_session()
    try:
        wl_settings = crud.water_level.get(session)
        if not wl_settings:
            logger.info("Skipping water level job: no water level settings found.")
            return {"status": "skipped", "reason": "missing_settings"}

        if not wl_settings.enabled:
            logger.info("Skipping water level job: water level collection is disabled.")
            return {"status": "skipped", "reason": "disabled"}

        wl_settings.get_new()
        logger.info("Water level job executed.")
        return {"status": "ok"}
    finally:
        session.close()


@celery_app.task(name="orc_api.tasks.run_disk_maintenance_job")
def run_disk_maintenance_job() -> dict:
    """Run disk maintenance cleanup when settings are available."""
    session = get_session()
    try:
        dm = crud.disk_management.get(session)
        if not dm:
            logger.warning("Skipping disk maintenance job: no disk management settings found.")
            return {"status": "skipped", "reason": "missing_settings"}

        dm_settings = DiskManagementResponse.model_validate(dm)
        dm_settings.cleanup(home_folder=UPLOAD_DIRECTORY)
        logger.info("Disk maintenance job executed.")
        return {"status": "ok"}
    finally:
        session.close()


@celery_app.task(name="orc_api.tasks.run_video")
def run_video(video_id: int, shutdown_after_task: bool = False) -> dict:
    """Process and run a video.

    Parameters
    ----------
    video_id : int
        ID of the video to process
    shutdown_after_task : bool, optional
        Whether to shutdown the device after processing

    Returns
    -------
    dict
        Status of the video processing

    """
    logger.info(f"Starting video processing for video_id={video_id}")
    try:
        with get_session() as db:
            video = db.get(Video, video_id)
            if not video:
                logger.error(f"Video with id={video_id} not found")
                return {"status": "error", "video_id": video_id, "message": "Video not found"}

            video_response = VideoResponse.model_validate(video)
        # check if output directory exists, if so delete first
        output = os.path.join(video_response.get_path(base_path=UPLOAD_DIRECTORY), "output")
        if os.path.exists(output):
            shutil.rmtree(output)
        video_response.run(UPLOAD_DIRECTORY, "", shutdown_after_task)
        logger.info(f"Video {video_id} processed successfully")
        return {"status": "ok", "video_id": video_id}
    except Exception as e:
        logger.error(f"Error processing video {video_id}: {str(e)}", exc_info=True)
        return {"status": "error", "video_id": video_id, "message": str(e)}


@celery_app.task(name="orc_api.tasks.sync_video")
def sync_video_task(video_id: int, site: int, sync_file: bool, sync_image: bool) -> dict:
    """Sync a video to a remote site.

    Parameters
    ----------
    video_id : int
        ID of the video to sync
    site : int
        Remote site ID
    sync_file : bool
        Whether to sync the video file
    sync_image : bool
        Whether to sync the image

    Returns
    -------
    dict
        Status of the sync operation

    """
    logger.info(f"Starting video sync for video_id={video_id}, site={site}")
    try:
        with get_session() as db:
            video = db.get(Video, video_id)
            if not video:
                logger.error(f"Video with id={video_id} not found")
                return {"status": "error", "video_id": video_id, "message": "Video not found"}

            video_response = VideoResponse.model_validate(video)

        video_response.sync_remote_wrapper(
            base_path=UPLOAD_DIRECTORY,
            site=site,
            sync_file=sync_file,
            sync_image=sync_image,
        )
        logger.info(f"Video {video_id} synced successfully to site {site}")
        return {"status": "ok", "video_id": video_id, "site": site}
    except Exception as e:
        logger.error(f"Error syncing video {video_id}: {str(e)}", exc_info=True)
        return {"status": "error", "video_id": video_id, "message": str(e)}


@celery_app.task(name="orc_api.tasks.sync_videos_batch")
def sync_videos_batch(video_ids: list, site: int, sync_file: bool, sync_image: bool) -> dict:
    """Sync multiple videos to a remote site.

    Parameters
    ----------
    video_ids : list
        List of video IDs to sync
    site : int
        Remote site ID
    sync_file : bool
        Whether to sync the video files
    sync_image : bool
        Whether to sync the images

    Returns
    -------
    dict
        Status of the batch sync operation

    """
    logger.info(f"Starting batch sync for {len(video_ids)} videos to site {site}")
    results = []
    for video_id in video_ids:
        result = sync_video_task(video_id=video_id, site=site, sync_file=sync_file, sync_image=sync_image)
        results.append(result)
    return {"status": "completed", "total": len(video_ids), "results": results}
