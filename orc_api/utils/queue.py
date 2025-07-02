"""queue functionality."""

from concurrent.futures import Executor
from logging import Logger

from fastapi import HTTPException
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db.video import VideoStatus
from orc_api.schemas.video import VideoPatch, VideoResponse


async def process_video_submission(
    session: Session, video: VideoResponse, logger: Logger, executor: Executor, upload_directory: str
):
    """Process and submit a video for execution.

    This function takes in a video object and performs necessary updates, such as
    modifying its status and submitting it for asynchronous execution using an executor.

    Parameters
    ----------
    session : sqlalchemy.orm.Session
        The database session used to query or update the video in the database.
    video : VideoResponse
        The video response object containing metadata about the video to be processed.
    logger : logging.Logger
        Logger instance.
    executor : concurrent.futures.Executor
        An executor instance for running asynchronous tasks related to video execution.
    upload_directory : str
        Absolute path of the directory where video files are uploaded.

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
            logger.info(f"Submitting video {video.file} to the executor.")
            # Update the status of the video
            # with get_session() as session:
            rec = crud.video.get(session, id=video.id)
            rec.status = VideoStatus.QUEUE
            session.commit()
            session.refresh(rec)
            video = VideoPatch.model_validate(rec)
            # Submit the video for execution
            try:
                # video.run(upload_directory)
                executor.submit(video.run, session, upload_directory)
            except Exception as e:
                logger.error(f"Failed to submit video {video.file}: {str(e)}")
                raise HTTPException(status_code=500, detail="Failed to process the video submission.")
            return video
        else:
            logger.error(f"{msg}")
            raise HTTPException(status_code=400, detail=f"{msg}")
    return video
