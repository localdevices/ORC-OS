"""queue functionality."""

import itertools
import os
import threading
from concurrent.futures import Executor, Future
from datetime import datetime
from logging import Logger
from queue import PriorityQueue

from fastapi import HTTPException
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db.base import SyncStatus
from orc_api.db.video import VideoStatus
from orc_api.schemas.video import VideoPatch, VideoResponse


class PriorityThreadPoolExecutor(Executor):
    """ThreadPoolExecutor with priority-based task queue."""

    def __init__(self, max_workers=None, thread_name_prefix=""):
        """Initialize the executor."""
        if max_workers is None or max_workers <= 0:
            raise ValueError("max_workers must be a positive integer")

        self._max_workers = max_workers
        self._thread_name_prefix = thread_name_prefix
        self._work_queue: PriorityQueue = PriorityQueue()
        self._threads: list[threading.Thread] = []
        self._shutdown = False
        self._shutdown_lock = threading.Lock()
        self._counter = itertools.count()  # tie-breaker to keep queue items comparable
        # Track how many worker threads are currently executing tasks
        self._active_workers = 0
        self._active_workers_lock = threading.Lock()

        # Start worker threads up-front
        for i in range(self._max_workers):
            t = threading.Thread(
                name=f"{self._thread_name_prefix}_{i}",
                target=self._worker,
                daemon=True,
            )
            self._threads.append(t)
            t.start()

    def submit(self, fn, *args, priority=100, **kwargs):
        """Submit a new task to the priority queue.

        Parameters
        ----------
        fn : callable
            function to execute
        args: list
            list of input arguments to `fn`
        priority : int
            Priority of the task (lower values = higher priority).
        kwargs : dict
            keyword input argument to `fn`

        Returns
        -------
        concurrent.futures.Future
            A Future object representing the execution of the task.

        """
        if priority is None:
            priority = 100

        with self._shutdown_lock:
            if self._shutdown:
                raise RuntimeError("Cannot submit new tasks after shutdown.")

            future = Future()
            # The counter ensures FIFO ordering among tasks with the same priority
            count = next(self._counter)
            # Queue item: (priority, count, fn, args, kwargs, future)
            self._work_queue.put((priority, count, fn, args, kwargs, future))
            return future

    def _worker(self):
        """Worker thread: pull tasks from the priority queue and execute them."""
        while True:
            with self._shutdown_lock:
                if self._shutdown and self._work_queue.empty():
                    # Graceful exit once shutdown requested and queue is drained
                    return

            try:
                # Blocks until a task is available or until woken up by another thread
                priority, count, fn, args, kwargs, future = self._work_queue.get(timeout=0.1)
            except Exception:
                # Timeout or interruption: re-check shutdown flag
                continue

            # If future is already cancelled, just mark task done and continue
            if not future.set_running_or_notify_cancel():
                self._work_queue.task_done()
                continue

            try:
                result = fn(*args, **kwargs)
            except Exception as exc:
                future.set_exception(exc)
            else:
                future.set_result(result)
            finally:
                self._work_queue.task_done()

    def shutdown(self, wait: bool = True, cancel_futures: bool = False):
        """Shut down the executor, optionally waiting for tasks to complete."""
        with self._shutdown_lock:
            self._shutdown = True
            if cancel_futures:
                # Cancel all pending futures that are still in the queue
                pending_items = []
                while not self._work_queue.empty():
                    try:
                        item = self._work_queue.get_nowait()
                    except Exception:
                        break
                    else:
                        pending_items.append(item)

                for _priority, _count, _fn, _args, _kwargs, future in pending_items:
                    future.cancel()
                    self._work_queue.task_done()

        if wait:
            for t in self._threads:
                t.join()


async def process_video(
    session: Session,
    video: VideoResponse,
    logger: Logger,
    executor: Executor,
    upload_directory: str,
    shutdown_after_task: bool = False,
    priority: int = 100,
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
    shutdown_after_task : bool, optional
        if set True, hard-shutdown the device after the task is processed. Requires sudo rights without password.
    priority : int, optional
        The lower the priority number, the higher the priority of the task in the executor queue.
        This can be used for instance to prioritize running videos that are coming in live with daemon settings on.

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
            rec = crud.video.get(session, id=video.id)
            rec.status = VideoStatus.QUEUE
            session.commit()
            session.refresh(rec)
            video = VideoPatch.model_validate(rec)
            # Submit the video for execution
            try:
                # processing is always performed at the highest priority
                executor.submit(video.run, upload_directory, "", shutdown_after_task, priority=priority)
                logger.info(f"Video {video.file} submitted to the executor for processing.")
            except Exception as e:
                logger.error(f"Failed to submit video {video.file} for processing: {str(e)}")
                raise HTTPException(status_code=500, detail="Failed to process the video submission for processing.")
            return video
        else:
            logger.error(f"{msg}")
            raise HTTPException(status_code=400, detail=f"{msg}")
    return video


async def sync_video(
    session: Session,
    video: VideoResponse,
    logger: Logger,
    site: int,
    sync_file: bool,
    sync_image: bool,
    executor: Executor,
    upload_directory: str,
):
    """Submit a video for synchronization to a remote site."""
    if video:
        # If the status is queued, then the video is already in the queue, should not be re-added
        ready_to_sync = video.sync_status != SyncStatus.QUEUE
        if ready_to_sync:
            logger.info(f"Submitting video {video.file} to the executor.")
            # Update the status of the video
            # with get_session() as session:
            rec = crud.video.get(session, id=video.id)
            rec.sync_status = SyncStatus.QUEUE
            session.commit()
            session.refresh(rec)
            video = VideoPatch.model_validate(rec)
            # Submit the video for synchronization
            try:
                executor.submit(
                    video.sync_remote_wrapper,
                    base_path=upload_directory,
                    site=site,
                    sync_file=sync_file,
                    sync_image=sync_image,
                )
                logger.info(f"Video {video.file} submitted to the executor for synchronization.")
            except Exception as e:
                logger.error(f"Failed to submit video {video.file} for synchronization: {str(e)}")
                raise HTTPException(
                    status_code=500, detail="Failed to process the video submission for synchronization."
                )
            return video
        else:
            msg = f"Video {video.id} - {video.file} is already in the queue."
            logger.error(msg)
            raise HTTPException(status_code=400, detail=f"{msg}")
    return video


async def sync_videos_start_stop(
    session: Session,
    executor: Executor,
    upload_directory: str,
    start: datetime,
    stop: datetime,
    logger: Logger,
    site: int,
    sync_file: bool,
    sync_image: bool,
    timeout: float,
):
    """Retrieve list of videos and submit for synchronization to a remote site."""
    videos = [
        crud.video.get_list(db=session, start=start, stop=stop, sync_status=SyncStatus.LOCAL),
        crud.video.get_list(db=session, start=start, stop=stop, sync_status=SyncStatus.UPDATED),
        crud.video.get_list(db=session, start=start, stop=stop, sync_status=SyncStatus.FAILED),
    ]
    # make one list of this list of videos
    videos = list(itertools.chain.from_iterable(videos))
    # start with LOCAl, then UPDATED, then FAILED
    video_count = len(videos)
    if start:
        start_str = start.strftime("%Y-%m-%dT%H:%M:%S")
    else:
        start_str = "beginning of records"
    if stop:
        stop_str = stop.strftime("%Y-%m-%dT%H:%M:%S")
    else:
        stop_str = "end of records"
    logger.info(f"Syncing {video_count} video records between {start_str} and {stop_str}")
    return await sync_videos_list(
        videos, session, executor, upload_directory, site, sync_file, sync_image, timeout=timeout
    )


async def sync_videos_list(
    videos: list[VideoResponse],
    session: Session,
    executor: Executor,
    upload_directory: str,
    site: int,
    sync_file: bool,
    sync_image: bool,
    timeout: float,
):
    """Submit a list of videos for synchronization to a remote site."""
    for v in videos:
        v.sync_status = SyncStatus.QUEUE
        # commit changes to database
        session.commit()
        session.refresh(v)
        v = VideoResponse.model_validate(v)
        file_path = v.get_video_file(base_path=upload_directory)
        image_path = v.get_image_file(base_path=upload_directory)
        s_f = sync_file and bool(file_path and os.path.isfile(file_path))
        s_i = sync_image and bool(image_path and os.path.isfile(image_path))

        executor.submit(
            v.sync_remote_wrapper, base_path=upload_directory, site=site, sync_file=s_f, sync_image=s_i, timeout=timeout
        )
    return videos
