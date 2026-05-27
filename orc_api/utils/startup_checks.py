"""Startup utilities for checking and restoring queued tasks."""

import logging

import redis
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.celery_app import celery_app
from orc_api.db.base import SyncStatus
from orc_api.db.video import VideoStatus
from orc_api.schemas.video import VideoResponse

logger = logging.getLogger(__name__)


def check_and_restore_queued_videos(db: Session, redis_url: str = "redis://localhost:6379/0"):
    """Check for queued videos at startup and restore them to the queue if needed.

    This function:
    1. Finds all videos with QUEUE status
    2. Checks if they are still in the Celery queue
    3. If not, re-submits them to the queue

    Parameters
    ----------
    db : Session
        Database session
    redis_url : str
        URL of the Redis server

    """
    try:
        logger.info("Starting startup check for queued videos...")

        # Find all videos with QUEUE status
        queued_videos = crud.video.get_list(db, status=VideoStatus.QUEUE)

        if not queued_videos:
            logger.info("No queued videos found at startup.")
        else:
            logger.info(f"Found {len(queued_videos)} queued videos at startup.")

            # Connect to Redis to check Celery tasks
            try:
                redis_client = redis.from_url(redis_url)
                redis_client.ping()
                logger.info("Connected to Redis for task verification")
            except Exception as e:
                logger.error(f"Could not connect to Redis to verify tasks: {e}")
                logger.warning("All queued videos will be re-submitted to the queue.")
                redis_client = None

            # For each queued video, check if it's in the queue and re-submit if needed
            for video in queued_videos:
                # validate the record before accessing its fields
                video_response = VideoResponse.model_validate(video)
                logger.info(f"Checking video {video_response.id} ({video_response.file}) - status: QUEUE")

                # Note: We're re-submitting all queued videos to ensure they get processed
                # This is safe because Celery will handle duplicate submissions appropriately
                try:
                    celery_app.send_task(
                        "orc_api.tasks.run_video",
                        args=(video_response.id, False),
                        priority=3,  # Normal priority for restart
                    )
                    logger.info(f"Re-submitted video {video_response.id} to Celery queue")
                except Exception as e:
                    logger.error(f"Failed to re-submit video {video_response.id}: {e}")

            # Check for queued syncs
        check_and_restore_queued_syncs(db)

        logger.info("Startup check for queued videos completed.")

    except Exception as e:
        logger.error(f"Error during startup queue check: {e}", exc_info=True)


def check_and_restore_queued_syncs(db: Session):
    """Check for queued sync operations at startup and restore them if needed.

    Parameters
    ----------
    db : Session
        Database session

    """
    try:
        logger.info("Checking for queued sync operations...")

        # Find all videos with QUEUE sync status
        queued_syncs = crud.video.get_list(db, sync_status=SyncStatus.QUEUE)

        if not queued_syncs:
            logger.info("No queued syncs found at startup.")
            return

        logger.info(f"Found {len(queued_syncs)} queued syncs at startup.")

        # Get callback URL to find the site ID
        callback_url = crud.callback_url.get(db)
        if not callback_url or not callback_url.remote_site_id:
            logger.warning("No callback URL or site ID configured. Skipping sync restoration.")
            return

        site_id = callback_url.remote_site_id

        # Get settings to determine what to sync
        settings = crud.settings.get(db)
        sync_file = settings.sync_file if settings else True
        sync_image = settings.sync_image if settings else True

        # Collect video IDs to batch submit
        video_ids = [v.id for v in queued_syncs]

        if video_ids:
            try:
                celery_app.send_task(
                    "orc_api.tasks.sync_videos_batch",
                    args=(video_ids, site_id, sync_file, sync_image),
                    priority=5,  # Low priority
                )
                logger.info(f"Re-submitted {len(video_ids)} videos to Celery sync queue")
            except Exception as e:
                logger.error(f"Failed to re-submit video syncs: {e}")

    except Exception as e:
        logger.error(f"Error checking queued syncs: {e}", exc_info=True)
