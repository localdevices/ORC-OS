"""queue functionality."""

import itertools
import logging
from datetime import datetime
from typing import Optional, Union

from fastapi import HTTPException
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.celery_app import celery_app
from orc_api.db.base import SyncStatus
from orc_api.db.video import Video, VideoStatus
from orc_api.schemas.video import VideoPatch, VideoResponse


async def process_video(
    session: Session,
    video: VideoResponse,
    logger: logging.Logger = logging.getLogger(__name__),
    shutdown_after_task: bool = False,
    priority: int = 0,
):
    """Process and submit a video for execution using Celery.

    This function takes in a video object and performs necessary updates, such as
    modifying its status and submitting it for asynchronous execution using Celery.

    Parameters
    ----------
    session : sqlalchemy.orm.Session
        The database session used to query or update the video in the database.
    video : VideoResponse
        The video response object containing metadata about the video to be processed.
    logger : logging.Logger
        Logger instance.
    shutdown_after_task : bool, optional
        if set True, hard-shutdown the device after the task is processed. Requires sudo rights without password.
    priority : int, optional
        The lower the priority number, the higher the priority of the task.
        Used to set Celery task priority if supported.

    Raises
    ------
    HTTPException
        Raised if the video submission fails or the video is not ready to run.

    Returns
    -------
    VideoPatch
        Updated video object reflecting status changes after successful submission.

    """
    if video:
        ready_to_run, msg = video.ready_to_run
        if ready_to_run:
            logger.info(f"Submitting video {video.file} to Celery queue.")
            # Update the status of the video
            rec = crud.video.get(session, id=video.id)
            if not rec:
                logger.error(f"Video record with ID {video.id} not found in the database.")
                raise HTTPException(status_code=404, detail="Video record not found.")
            # Submit the video for execution using Celery
            try:
                celery_app.send_task(
                    "orc_api.tasks.run_video",
                    args=(video.id, shutdown_after_task),
                    priority=priority if priority < 10 else 5,  # Map to Celery priority range
                )
                logger.info(f"Video {video.file} submitted to Celery queue for processing.")
            except Exception as e:
                logger.error(f"Failed to submit video {video.file} for processing: {str(e)}")
                raise HTTPException(status_code=500, detail="Failed to process the video submission for processing.")
            # the task is now successfully submitted, update status to queue
            rec.status = VideoStatus.QUEUE
            session.commit()
            session.refresh(rec)
            video_patch = VideoPatch.model_validate(rec)

            return video_patch
        else:
            logger.error(f"{msg}")
            raise HTTPException(status_code=400, detail=f"{msg}")
    return video


async def sync_video(
    session: Session,
    video: VideoResponse,
    logger: logging.Logger = logging.getLogger(__name__),
    site: Optional[int] = None,
    sync_file: bool = True,
    sync_image: bool = True,
):
    """Submit a video for synchronization to a remote site using Celery."""
    if not site:
        # return as is when no site id is provided.
        logger.warning("No site ID provided for video synchronization. Cannot synchronize.")
        return video
    if video:
        # If the status is queued, then the video is already in the queue, should not be re-added
        ready_to_sync = video.sync_status != SyncStatus.QUEUE
        if ready_to_sync:
            logger.info(f"Submitting video {video.file} to Celery queue for sync.")
            # Update the status of the video
            rec = crud.video.get(session, id=video.id)
            if not rec:
                logger.error(f"Video record with ID {video.id} not found in the database.")
                raise HTTPException(status_code=404, detail="Video record not found.")
            rec.sync_status = SyncStatus.QUEUE
            session.commit()
            session.refresh(rec)
            video_patch = VideoPatch.model_validate(rec)

            # Submit the video for synchronization using Celery
            try:
                celery_app.send_task(
                    "orc_api.tasks.sync_video",
                    args=(video.id, site, sync_file, sync_image),
                )
                logger.info(f"Video {video.file} submitted to Celery queue for synchronization.")
            except Exception as e:
                logger.error(f"Failed to submit video {video.file} for synchronization: {str(e)}")
                raise HTTPException(
                    status_code=500, detail="Failed to process the video submission for synchronization."
                )
            return video_patch
        else:
            msg = f"Video {video.id} - {video.file} is already in the queue."
            logger.error(msg)
            raise HTTPException(status_code=400, detail=f"{msg}")
    return video


async def sync_videos_start_stop(
    session: Session,
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    logger: logging.Logger = logging.getLogger(__name__),
    site: Optional[int] = None,
    sync_file: bool = True,
    sync_image: bool = True,
):
    """Retrieve list of videos and submit for synchronization to a remote site using Celery."""
    if not site:
        logger.warning("No site ID provided for video synchronization. Cannot synchronize.")
        return []
    videos = [
        crud.video.get_list(db=session, start=start, stop=stop, sync_status=SyncStatus.LOCAL),
        crud.video.get_list(db=session, start=start, stop=stop, sync_status=SyncStatus.UPDATED),
        crud.video.get_list(db=session, start=start, stop=stop, sync_status=SyncStatus.FAILED),
    ]
    # make one list of this list of videos
    videos = list(itertools.chain.from_iterable(videos))
    # start with LOCAL, then UPDATED, then FAILED
    video_count = len(videos)
    if start:
        start_str = start.strftime("%Y-%m-%dT%H:%M:%S")
    else:
        start_str = "beginning of records"
    if stop:
        stop_str = stop.strftime("%Y-%m-%dT%H:%M:%S")
    else:
        stop_str = "end of records"
    if video_count == 0:
        logger.info(f"No videos found between {start_str} and {stop_str} for synchronization.")
        return []
    logger.info(f"Syncing {video_count} video records between {start_str} and {stop_str}")
    return await sync_videos_list(
        videos=videos, session=session, site=site, sync_file=sync_file, sync_image=sync_image, logger=logger
    )


async def sync_videos_list(
    videos: list[Union[VideoResponse, Video]],
    session: Session,
    site: Optional[int] = None,
    sync_file: bool = True,
    sync_image: bool = True,
    logger: logging.Logger = logging.getLogger(__name__),
):
    """Submit a list of videos for synchronization to a remote site using Celery."""
    if not site:
        # immediately return as is
        logger.warning("No site ID provided for video synchronization. Cannot synchronize.")
        return videos
    video_ids = []
    for v in videos:
        video_rec = crud.video.get(session, id=v.id)
        if video_rec:
            video_rec.sync_status = SyncStatus.QUEUE
            session.commit()
            video_ids.append(video_rec.id)

    if video_ids:
        logger.info(f"Submitting {len(video_ids)} videos to Celery queue for batch sync.")
        try:
            celery_app.send_task(
                "orc_api.tasks.sync_videos_batch",
                args=(video_ids, site, sync_file, sync_image),
            )
            logger.info(f"Batch of {len(video_ids)} videos submitted to Celery queue for synchronization.")
        except Exception as e:
            logger.error(f"Failed to submit video batch for synchronization: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to process the video batch submission for synchronization."
            )

    return videos
