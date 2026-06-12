"""Video routers."""

import asyncio
import copy
import mimetypes
import os
import time
import traceback  # only used in DEV_MODE
from datetime import datetime
from enum import Enum
from typing import List, Optional, Union
from zipfile import ZIP_DEFLATED

import cv2
import zipstream
from fastapi import (  # Requests holds the app
    APIRouter,
    Depends,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

# Directory to save uploaded files
from orc_api import DEV_MODE, UPLOAD_DIRECTORY, crud
from orc_api.database import get_db
from orc_api.db import SyncStatus, VideoStatus
from orc_api.log import logger
from orc_api.routers.ws.video import WSVideoMsg, WSVideoState
from orc_api.schemas.video import (
    DeleteVideosRequest,
    DownloadVideosRequest,
    SyncVideosRequest,
    VideoListResponse,
    VideoPatch,
    VideoResponse,
)
from orc_api.schemas.video_config import VideoConfigResponse
from orc_api.utils import queue, websockets
from orc_api.utils.image import get_frame_count, get_frame_from_cap, yield_frames_from_fn
from orc_api.utils.redis_pubsub import get_redis_pubsub_manager
from orc_api.utils.states import SyncRunStatus, VideoRunStatus

router: APIRouter = APIRouter(prefix="/video", tags=["video"])

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

# start a websockets connection manager
conn_manager = websockets.ConnectionManager()

# Add state manager for tracking playback per video
_frame_stream_states = {}


async def redis_available() -> None:
    """Check if Redis connection is available for video synchronization."""
    try:
        pubsub_manager = await get_redis_pubsub_manager()
        if await pubsub_manager.is_available() is False:
            raise HTTPException(status_code=500, detail="Redis connection is not available for video synchronization.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Redis for video synchronization: {str(e)}")


def get_video_record(db: Session, id: int) -> VideoResponse:
    """Retrieve a video record from the database."""
    video_rec = crud.video.get(db=db, id=id)
    if not video_rec:
        raise HTTPException(status_code=404, detail="Video not found.")
    # Open the video file
    return VideoResponse.model_validate(video_rec)


# helpers
async def zip_generator(files, base_path):
    """Async generator to stream the zip file content."""
    z = zipstream.ZipFile(mode="w", compression=ZIP_DEFLATED)
    # Find common base path
    for f in files:
        if not os.path.isfile(f):
            logger.warning(f"File {f} does not exist. Skipping.")
            continue
        relative_path = os.path.relpath(f, base_path)
        z.write(f, arcname=relative_path)
    for chunk in z:
        yield chunk


@router.get("/{id}/thumbnail/", response_class=FileResponse, status_code=200)
async def get_thumbnail(id: int, db: Session = Depends(get_db)):
    """Retrieve a thumbnail for a video."""
    video = get_video_record(db, id)
    if not video.thumbnail:
        raise HTTPException(status_code=404, detail="Video record is found, but thumbnail is not found.")
    # Determine the MIME type of the file
    file_path = video.get_thumbnail(base_path=UPLOAD_DIRECTORY)

    # close database to prevent overflow issues when calling many thumbnail files
    db.close()
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Thumbnail file not found on local data store.")

    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"  # Fallback MIME type

    return FileResponse(file_path, media_type=mime_type)


@router.get("/{id}/log/", response_model=str, status_code=200)
async def get_video_log(id: int, db: Session = Depends(get_db)):
    """Retrieve a log for a video and return as string."""
    video = get_video_record(db, id)
    log_file = video.get_log_file(base_path=UPLOAD_DIRECTORY)
    if not os.path.exists(log_file):
        raise HTTPException(status_code=404, detail="Video record is found, but log is not found.")
    with open(log_file, "r") as f:
        log_str = f.read()
    return log_str


@router.get("/{id}/frame/{frame_nr}", response_class=FileResponse, status_code=200)
async def get_frame(id: int, frame_nr: int, rotate: Optional[int] = None, db: Session = Depends(get_db)):
    """Retrieve single frame from video."""
    # convert into schema and return data
    video = get_video_record(db, id)
    if not video.file:
        raise HTTPException(status_code=404, detail="Video record is found, but video file is not found.")
    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)

    # prevent unnecessarily long database connection, close!
    db.close()
    # open video
    cap = cv2.VideoCapture(file_path)
    # set to frame
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_nr)
    # Read the frame
    success, io_buf = get_frame_from_cap(cap, rotate)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to read frame")

    # # Validate and apply rotation if specified
    # if rotate is not None:
    #     if rotate not in [90, 180, 270]:
    #         raise HTTPException(status_code=400, detail="Rotation must be None, 90, 180 or 270 degrees")
    #     if rotate == 90:
    #         frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    #     elif rotate == 180:
    #         frame = cv2.rotate(frame, cv2.ROTATE_180)
    #     elif rotate == 270:
    #         frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)

    # # Convert the frame to jpg format
    # _, buffer = cv2.imencode(".jpg", frame)
    # io_buf = io.BytesIO(buffer.tobytes())
    # Clean up
    cap.release()
    # Return the frame as a streaming response
    return StreamingResponse(io_buf, media_type="image/jpeg")


@router.get("/{id}/frames/")  # , response_class=FileResponse, status_code=200)
async def get_frames(
    id: int,
    start_frame: Optional[int] = None,
    end_frame: Optional[int] = None,
    rotate: Optional[int] = None,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Retrieve frames with repetition from video."""
    # convert into schema and return data
    if start_frame is None:
        start_frame = 0
    video = get_video_record(db, id)
    if not video.file:
        raise HTTPException(status_code=404, detail="Video record is found, but video file is not found.")
    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)
    # check for physical presence
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found on local data store.")
    if end_frame is None:
        end_frame = get_frame_count(file_path)

    # prevent unnecessarily long database connection, close!
    db.close()

    async def frame_generator():
        for frame in yield_frames_from_fn(file_path, rotate, start_frame, end_frame):
            if await request.is_disconnected():
                logger.info(f"Client disconnected while streaming frames for video {id}. Stopping generator.")
                break
            yield frame

    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/{id}/frames_with_state/")
async def get_frames_with_state(
    id: int,
    rotate: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Stream frames, respecting play/pause/seek state from control WebSocket."""
    video = get_video_record(db, id)
    if not video.file:
        raise HTTPException(status_code=404, detail="Video file not found")

    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    db.close()

    async def frame_generator():
        """Stream frames while respecting state from control channel."""
        cap = cv2.VideoCapture(file_path)
        try:
            # set initial states
            last_frame_sent_time = time.time()
            frame_send_interval = 1.0 / cap.get(cv2.CAP_PROP_FPS)
            paused = False  # used to detect if already paused or not. Only send last frame if just paused
            paused_frame = 0  # used to track which frame we are on when paused, so we can resend if seek is called
            # state = {"is_playing": True, "current_frame": 0, "total_frames": get_frame_count(file_path)}
            while True:
                # Get current state (modified by control WebSocket)
                state = _frame_stream_states.get(id)
                if state is None:
                    break

                if state["is_playing"]:
                    paused = False
                    if state["current_frame"] >= state["total_frames"]:
                        state["current_frame"] = 0  # Loop back to start
                        # reopen the cap
                        cap.release()
                        del cap
                        cap = cv2.VideoCapture(file_path)
                    # Set to current frame
                    success, io_buf = get_frame_from_cap(cap, rotate)

                    if not success:
                        state["is_playing"] = False
                    else:
                        io_buf.seek(0)
                        while time.time() - last_frame_sent_time < frame_send_interval:
                            await asyncio.sleep(0.001)  # Wait until it's time to send the next frame
                        last_frame_sent_time = time.time()
                        frame_data = b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + io_buf.read() + b"\r\n"
                        state["current_frame"] += 1
                        yield frame_data
                    # await asyncio.sleep(0.01)  # ~30 FPS
                else:
                    if not paused or paused_frame != state["current_frame"]:
                        # apparently we just paused, so we will forward the last frame and then wait until we start
                        # playing again
                        paused = True
                        # Paused: still serve current frame
                        if state["current_frame"] >= state["total_frames"]:
                            state["current_frame"] = 0  # Loop back to start
                            # reopen the cap
                            cap.release()
                            del cap
                            cap = cv2.VideoCapture(file_path)

                        success, io_buf = get_frame_from_cap(cap, rotate)
                        # reset to previous frame
                        cap.release()
                        del cap
                        cap = cv2.VideoCapture(file_path)
                        cap.set(cv2.CAP_PROP_POS_FRAMES, state["current_frame"])

                        if success:
                            io_buf.seek(0)
                            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + io_buf.read() + b"\r\n")
                            # send another time, otherwise the browser does not render it
                            io_buf.seek(0)
                            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + io_buf.read() + b"\r\n")
                        paused_frame = state["current_frame"]

                    await asyncio.sleep(0.01)  # Lower frequency when paused
        finally:
            cap.release()
            del cap

    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/", response_model=List[VideoListResponse], status_code=200)
async def get_list_video(
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    status: Optional[Union[VideoStatus, int]] = Query(default=None),
    first: Optional[int] = None,
    count: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retrieve list of videos."""
    if isinstance(status, int):
        try:
            status = VideoStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status value '{status}'.")

    list_videos = crud.video.get_list(db, start=start, stop=stop, status=status, first=first, count=count)
    unique_video_configs = set([v.video_config_id for v in list_videos if v.video_config_id is not None])
    video_configs = {v: VideoConfigResponse.model_validate(crud.video_config.get(db, v)) for v in unique_video_configs}
    video_list_responses = [
        VideoListResponse.from_orm_model(video, video_configs[video.video_config_id] if video.video_config_id else None)
        for video in list_videos
    ]
    return video_list_responses


@router.get("/count/", response_model=int, status_code=200)
async def get_list_video_count(
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    status: Optional[Union[VideoStatus, int]] = Query(default=None),
    sync_status: Optional[Union[SyncStatus, int]] = Query(default=None),
    first: Optional[int] = None,
    count: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retrieve only count of list of videos."""
    if isinstance(status, int):
        try:
            status = VideoStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status value '{status}'.")

    if isinstance(sync_status, int):
        try:
            sync_status = SyncStatus(sync_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid sync status value '{sync_status}'.")

    list_videos_count = crud.video.get_list_count(
        db, start=start, stop=stop, status=status, sync_status=sync_status, first=first, count=count
    )
    return list_videos_count


@router.get("/{id}/", response_model=VideoResponse, status_code=200)
async def get_video(id: int, db: Session = Depends(get_db)):
    """Retrieve metadata for a video."""
    return get_video_record(db, id)


@router.get("/{id}/frame_count/", response_model=int, status_code=200)
async def get_video_end_frame(id: int, db: Session = Depends(get_db)):
    """Retrieve the end frame of a video."""
    video = get_video_record(db, id)
    # open video
    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)

    # close db connection
    db.close()
    # open video
    return get_frame_count(file_path)
    # cap = cv2.VideoCapture(file_path)
    # # check amount of frames
    # frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # return frame_count


@router.delete("/{id}/", status_code=204, response_model=None)
async def delete_video(id: int, db: Session = Depends(get_db)):
    """Delete a video."""
    _ = crud.video.delete(db=db, id=id)
    return


@router.patch("/{id}/", status_code=200, response_model=VideoResponse)
async def patch_video(id: int, video: dict, db: Session = Depends(get_db)):
    """Update a video in the database."""
    # update_video = video.model_dump(exclude_none=True, exclude={"id", "video_config", "time_series"})
    video = crud.video.update(db=db, id=id, video=video)
    return video


@router.post("/delete/", status_code=204, response_model=None)
async def delete_list_videos(request: DeleteVideosRequest, db: Session = Depends(get_db)):
    """Delete a list of videos."""
    start = request.start
    stop = request.stop
    try:
        _ = crud.video.delete_start_stop(db=db, start=start, stop=stop)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return None


@router.get("/{id}/play/", response_class=StreamingResponse, status_code=206)
async def play_video(id: int, range: str = Header(None), db: Session = Depends(get_db)):
    """Retrieve a video file and stream it to the client."""
    video = get_video_record(db, id)
    video = VideoResponse.model_validate(video)
    if not video.file:  # Assuming `file_path` is the attribute storing the video's path
        raise HTTPException(status_code=404, detail="Video file field not available.")
    # convert into schema and return data

    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)

    # close db connection
    db.close()
    # Ensure the file exists
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Video file not found on local data store. Please check your upload directory and try again. "
            "If the problem persists, please contact the administrator for assistance.",
        )

    # Determine the MIME type of the file based on the extension
    # mime_type, _ = mimetypes.guess_type(file_path)
    # if not mime_type:
    mime_type = "video/mp4"  # Fallback MIME type for unknown files, if that fails, probably file is downloaded

    # File size
    file_size = os.path.getsize(file_path)

    # Handle range requests for partial content
    start = 0
    end = file_size - 1  # Default to serve the entire file

    if range:
        # Parse the Range header (e.g., "bytes=0-1023")
        range_start, range_end = range.replace("bytes=", "").split("-")
        start = int(range_start) if range_start else start
        end = int(range_end) if range_end else end

        # Validate range values
        if start > end or start >= file_size or end >= file_size:
            raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

    content_length = end - start + 1

    # iterator for streaming the video file
    def iter_file(file_path, start, content_length):
        with open(file_path, "rb") as video_file:
            video_file.seek(start)
            bytes_remaining = content_length
            while bytes_remaining > 0:
                # while chunk := video_file.read(1024 * 1024):  # Stream in chunks (1MB)
                chunk_size = min(1024 * 1024, bytes_remaining)  # Stream in chunks of 1 MB or less (remaining bytes)
                chunk = video_file.read(chunk_size)
                if not chunk:  # Ensure EOF is properly handled
                    break
                bytes_remaining -= len(chunk)
                yield chunk

    # Set headers to support partial content (HTTP 206)
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
    }

    # Return the streaming response with the appropriate headers
    return StreamingResponse(
        iter_file(file_path, start, content_length), media_type=mime_type, headers=headers, status_code=206
    )


@router.get("/{id}/run/", response_model=VideoPatch, status_code=200)
async def run_video(id: int, request: Request, db: Session = Depends(get_db)):
    """Submit a video for processing to the Celery queue."""
    await redis_available()
    video = get_video_record(db, id)
    # session = request.app.state.session
    video_patch = await queue.process_video(
        session=db,
        video=video,
        logger=logger,
    )
    return video_patch


@router.get("/{id}/image/", response_class=FileResponse, status_code=200)
async def get_image(id: int, db: Session = Depends(get_db)):
    """Retrieve an image result from video record."""
    video = get_video_record(db, id)
    if not video.image:  # Assuming `file_path` is the attribute storing the video's path
        raise HTTPException(status_code=404, detail="Image file field not available.")

    file_path = video.get_image_file(base_path=UPLOAD_DIRECTORY)

    # close db connection
    db.close()
    # Ensure the file exists
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Image file not found on local data store. Please check your upload directory and try again. "
            "If the problem persists, please contact the administrator for assistance.",
        )

    # Determine the MIME type of the file based on the extension
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "image/jpeg"  # Fallback MIME type for unknown files, if that fails, probably file is downloaded

    # Return the video file using FileResponse
    return FileResponse(file_path, media_type=mime_type)


@router.post("/", response_model=VideoResponse, status_code=201)
async def upload_video(
    file: UploadFile,
    timestamp: datetime = Form(...),
    video_config_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a video file and create a new entry in the database."""
    video_instance = await crud.video.create_from_upload(
        db=db, file=file, timestamp=timestamp, video_config_id=video_config_id
    )
    return VideoResponse.model_validate(video_instance)


@router.post("/download/", status_code=200, response_class=StreamingResponse)
async def download_videos(request: DownloadVideosRequest, db: Session = Depends(get_db)):
    """Retrieve files from server and create a streaming zip towards the client."""
    get_image = request.get_image
    get_video = request.get_video
    get_netcdfs = request.get_netcdfs
    get_log = request.get_log
    start = request.start
    stop = request.stop

    """Retrieve files from server and create a streaming zip towards the client."""
    videos = crud.video.get_list(db=db, start=start, stop=stop)
    if len(videos) == 0:
        raise HTTPException(status_code=404, detail="No videos found in database with selected ids.")
    # create a list of files that must be zipped
    files_to_zip = []
    for video in videos:
        video = VideoResponse.model_validate(video)
        if get_image and video.get_image_file(base_path=UPLOAD_DIRECTORY):
            files_to_zip.append(video.get_image_file(base_path=UPLOAD_DIRECTORY))
        if get_video and video.get_video_file(base_path=UPLOAD_DIRECTORY):
            files_to_zip.append(video.get_video_file(base_path=UPLOAD_DIRECTORY))
        if get_netcdfs and video.get_netcdf_files(base_path=UPLOAD_DIRECTORY):
            files_to_zip += video.get_netcdf_files(base_path=UPLOAD_DIRECTORY)
        if get_log:
            # TODO: figure out default name for .log file and also return that
            pass
    # close database connection!
    db.close()
    return StreamingResponse(
        zip_generator(files_to_zip, base_path=UPLOAD_DIRECTORY),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'},
    )


@router.post("/download_ids/", status_code=200, response_class=StreamingResponse)
async def download_videos_on_ids(
    ids: List[int] = None,
    get_image: bool = True,
    get_video: bool = True,
    get_netcdfs: bool = True,
    get_log: bool = True,
    db: Session = Depends(get_db),
):
    """Retrieve files from server and create a streaming zip towards the client."""
    videos = crud.video.get_ids(db=db, ids=ids)
    if len(videos) == 0:
        raise HTTPException(status_code=404, detail="No videos found in database with selected ids.")
    # create a list of files that must be zipped
    files_to_zip = []
    for video in videos:
        video = VideoResponse.model_validate(video)
        if get_image and video.get_image_file(base_path=UPLOAD_DIRECTORY):
            files_to_zip.append(video.get_image_file(base_path=UPLOAD_DIRECTORY))
        if get_video and video.get_video_file(base_path=UPLOAD_DIRECTORY):
            files_to_zip.append(video.get_video_file(base_path=UPLOAD_DIRECTORY))
        if get_netcdfs and video.get_netcdf_files(base_path=UPLOAD_DIRECTORY):
            files_to_zip += video.get_netcdf_files(base_path=UPLOAD_DIRECTORY)
        if get_log:
            # TODO: figure out default name for .log file and also return that
            pass
    _ = [(os.path.basename(f), f) for f in files_to_zip]
    # close database connection!
    db.close()
    return StreamingResponse(
        zip_generator(files_to_zip, base_path=UPLOAD_DIRECTORY),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'},
    )


@router.post("/{id}/sync/", status_code=200, response_model=None)
async def sync_video(id: int, request: Request, db: Session = Depends(get_db)):
    """Sync a selected video."""
    # first check if redis connection is available, if not, return error immediately
    await redis_available()
    # if no settings found assume everything should be synced
    sync_file = True
    sync_image = True

    video = get_video_record(db, id)
    # check if a valid callback url with site id is available.
    callback_url = crud.callback_url.get(db)
    if callback_url is None:
        raise HTTPException(
            status_code=400,
            detail="No callback url available. Please configure a valid LiveORC callback url with user email/password "
            "to report on.",
        )
    if callback_url.remote_site_id is None:
        raise HTTPException(
            status_code=400,
            detail="No remote site id available. Please configure a LiveORC site to report on.",
        )
    # also retrieve settings to find out what should be synced
    settings = crud.settings.get(db)
    # if no settings found assume everything should be synced
    if settings is not None:
        sync_file = settings.sync_file
        sync_image = settings.sync_image

    # Submit to Celery queue
    video_patch = await queue.sync_video(
        session=db,
        video=video,
        logger=logger,
        site=callback_url.remote_site_id,
        sync_file=sync_file,
        sync_image=sync_image,
    )
    return video_patch


@router.post("/sync/", status_code=200, response_model=List[VideoResponse])
async def sync_list_videos(request: Request, params: SyncVideosRequest, db: Session = Depends(get_db)):
    """Sync a list of videos using Celery queue."""
    # first check if redis connection is available, if not, return error immediately
    await redis_available()
    sync_image = params.sync_image
    sync_file = params.sync_file
    start = params.start
    stop = params.stop
    site = params.site
    url = crud.callback_url.get(db)
    if site is None:
        # get the site from the callback url settings
        if url is None:
            raise HTTPException(
                status_code=400,
                detail="No callback url with site available. Please configure a LiveORC callback url with user "
                "email/password and a site ID to report on.",
            )
        site = url.remote_site_id
    try:
        videos = await queue.sync_videos_start_stop(
            session=db,
            start=start,
            stop=stop,
            logger=logger,
            site=site,
            sync_file=sync_file,
            sync_image=sync_image,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error syncing videos: {str(e)}")
    msg = f"{len(videos)} videos submitted for syncing to site {site}."
    logger.info(msg)
    return videos


@router.websocket("/status/")
async def update_video_ws(websocket: WebSocket):
    """Get continuous status of the update process via websocket using Redis pub/sub."""
    await conn_manager.connect(websocket)
    logger.info(f"Connected websocket: {websocket}")

    await conn_manager.send_json(
        websocket=websocket,
        json={
            "video_id": 0,
            "video_file": "",
            "status": VideoRunStatus.IDLE.value,
            "sync_status": SyncRunStatus.IDLE.value,
            "message": "Subscribed to video status updates.",
        },
    )

    try:
        # Get Redis pub/sub manager and subscribe to video status channels
        pubsub_manager = await get_redis_pubsub_manager()

        # Create tasks for both channels
        video_status_task = asyncio.create_task(
            pubsub_manager.subscribe_and_stream(websocket, ["video_status", "video_sync_status"])
        )

        # Wait for the pub/sub stream (will run until disconnected or error)
        await video_status_task

    except WebSocketDisconnect:
        logger.info(f"Websocket {websocket} disconnected.")
        conn_manager.disconnect(websocket)
    except Exception as e:
        if DEV_MODE:
            traceback.print_exc()
        logger.error(f"Websocket error: {e}")
        conn_manager.disconnect(websocket)
    except asyncio.CancelledError:
        logger.info(f"Websocket {websocket} cancelled.")
        conn_manager.disconnect(websocket)


@router.websocket("/{id}/video_ws/")
async def video_ws(websocket: WebSocket, id: int, name: Optional[str] = None):
    """Get continuous status of video config belonging to video via websocket."""
    await conn_manager.connect(websocket)
    logger.info(f"Connected websocket for video config data exchange: {websocket}")
    # initialize the websocket state
    try:
        db = next(get_db())
        video_rec = crud.video.get(db=db, id=id)
        video = VideoResponse.model_validate(video_rec)
        # create a state for the rest of the session
        video_state = WSVideoState(video=video, saved=True)
        db.close()
        await websocket.send_json(video_state.model_dump(mode="json"))

    except Exception as e:
        await websocket.send_json({"error": str(e)})
        if DEV_MODE:
            traceback.print_exc()
        logger.error(f"Error sending video config data to websocket: {e}")
        await websocket.close()
        return

    try:
        while True:
            # read requests from client
            msg = await websocket.receive_json()
            if DEV_MODE:
                logger.debug(f"Received message from websocket: {msg}")
            # validate message
            msg = WSVideoMsg.model_validate(msg)
            # perform operations on video config
            if msg.action == "save":
                name = msg.params.pop("name", None)
                r = video_state.save(name=name)
            elif msg.action == "reset_video_config":
                r = video_state.reset_video_config()
            elif msg.action == "update_video_config":
                # update with the operation and parameters only
                r = video_state.update_video_config(**msg.model_dump(exclude={"action"}))
            await websocket.send_json(r.model_dump(mode="json"))
    except WebSocketDisconnect:
        logger.info(f"Websocket {websocket} for video_config_id {id} disconnected.")
        conn_manager.disconnect(websocket)
        # await websocket.close()
    except Exception as e:
        if DEV_MODE:
            traceback.print_exc()
        logger.error(f"Websocket error: {e}")
        conn_manager.disconnect(websocket)
    except asyncio.CancelledError:
        logger.info(f"Websocket {websocket} for video_config_id {id} cancelled.")
        conn_manager.disconnect(websocket)


class FrameStreamCommand(str, Enum):
    """Commands for frame streaming."""

    PLAY = "play"
    PAUSE = "pause"
    STOP = "stop"
    SEEK = "seek"  # Seek to specific frame
    FORWARD = "forward"  # Next frame
    REWIND = "rewind"  # Previous frame


# @router.websocket("/{id}/frames_interactive/")
# async def frames_interactive_ws(websocket: WebSocket, id: int):
#     """Interactive frame streaming via WebSocket."""
#     await conn_manager.connect(websocket)
#     logger.info(f"Connected WebSocket for interactive frames: {websocket}")

#     is_playing = True
#     rotate = None

#     try:
#         db = next(get_db())
#         video = get_video_record(db, id)
#         if not video.file:
#             await websocket.send_json({"error": "Video file not found"})
#             await websocket.close()
#             return

#         file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)
#         db.close()

#         # Frame streaming state
#         total_frames = get_frame_count(file_path)
#         current_frame = 0
#         # Send initial state to client
#         await websocket.send_json(
#             {
#                 "type": "state",
#                 "total_frames": total_frames,
#                 "current_frame": current_frame,
#                 "is_playing": is_playing,
#             }
#         )

#         # Create OpenCV capture once
#         cap = cv2.VideoCapture(file_path)
#     except Exception as e:
#         if DEV_MODE:
#             traceback.print_exc()
#         logger.error(f"Error initializing interactive frame streaming: {e}")
#         await websocket.send_json({"error": str(e)})
#         await websocket.close()
#         return

#     is_playing = True
#     rotate = None

#     try:
#         while True:
#             # Check for incoming commands (non-blocking)
#             try:
#                 msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)

#                 if msg.get("type") == "command":
#                     command = msg.get("command")

#                     if command == FrameStreamCommand.PLAY:
#                         is_playing = True
#                         logger.debug("Play command received")

#                     elif command == FrameStreamCommand.PAUSE:
#                         is_playing = False
#                         logger.debug("Pause command received")

#                     elif command == FrameStreamCommand.STOP:
#                         break

#                     elif command == FrameStreamCommand.SEEK:
#                         target_frame = msg.get("frame", 0)
#                         current_frame = max(0, min(target_frame, total_frames - 1))
#                         cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame)
#                         logger.debug(f"Seek to frame {current_frame}")

#                     elif command == FrameStreamCommand.FORWARD:
#                         if current_frame < total_frames - 1:
#                             current_frame += 1
#                             cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame)
#                             logger.debug(f"Forward to frame {current_frame}")

#                     elif command == FrameStreamCommand.REWIND:
#                         if current_frame > 0:
#                             current_frame -= 1
#                             cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame)
#                         logger.debug(f"Rewind to frame {current_frame}")

#                     elif command == "set_rotate":
#                         rotate = msg.get("rotate")
#                         logger.debug(f"Rotate set to {rotate}")

#             except asyncio.TimeoutError:
#                 # No message received, continue streaming if playing
#                 pass

#             # Stream frame if playing
#             if is_playing and current_frame < total_frames:
#                 print(f"Streaming frame {current_frame}/{total_frames}")
#                 success, io_buf = get_frame_from_cap(cap, rotate)

#                 if not success:
#                     print(f"Failed to read frame {current_frame}. Stopping playback.")
#                     # End of video reached
#                     is_playing = False
#                     await websocket.send_json(
#                         {
#                             "type": "state",
#                             "current_frame": current_frame,
#                             "is_playing": False,
#                             "message": "End of video",
#                         }
#                     )
#                 else:
#                     # Send frame data as base64
#                     # import base64

#                     # io_buf.seek(0)
#                     # frame_data = base64.b64encode(io_buf.read()).decode("utf-8")

#                     await websocket.send_json(
#                         {
#                             "type": "frame_header",
#                             "current_frame": current_frame,
#                             "total_frames": total_frames,
#                             # "frame_data": frame_data,  # Base64 encoded JPEG
#                             "is_playing": is_playing,
#                         }
#                     )
#                     io_buf.seek(0)
#                     # send io buffer separately and directly as binary blob
#                     await websocket.send_bytes(io_buf.read())

#                     current_frame += 1
#                     # Small delay to simulate playback speed (adjust as needed)
#                     # await asyncio.sleep(0.033)  # ~30 FPS

#             else:
#                 # Not playing, just check for commands
#                 await asyncio.sleep(0.01)

#     except Exception as e:
#         logger.error(f"WebSocket error: {e}")
#         if DEV_MODE:
#             traceback.print_exc()
#         conn_manager.disconnect(websocket)
#     except asyncio.CancelledError:
#         logger.info("WebSocket cancelled")
#         conn_manager.disconnect(websocket)
#     finally:
#         cap.release()


@router.websocket("/{id}/frames_interactive/")
async def frames_control_ws(websocket: WebSocket, id: int):
    """Control WebSocket - only handles play/pause/seek commands."""
    await conn_manager.connect(websocket)
    logger.info(f"Connected control WebSocket for video {id}")

    # Initialize state
    _frame_stream_states[id] = {
        "current_frame": 0,
        "is_playing": False,
        "total_frames": 0,
    }

    try:
        db = next(get_db())
        video = get_video_record(db, id)
        file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)
        db.close()

        total_frames = get_frame_count(file_path)
        _frame_stream_states[id]["total_frames"] = total_frames

        # Send initial state
        await websocket.send_json(
            {
                "type": "state",
                "total_frames": total_frames,
                "current_frame": 0,
                "is_playing": False,
            }
        )
        # initialize empty
        frame_stream_state_id = {}
        while True:
            # send new state to client
            # await websocket.send_json({
            #     "type": "state",
            #     "current_frame": _frame_stream_states[id]["current_frame"],
            #     "is_playing": _frame_stream_states[id]["is_playing"],
            #     "total_frames": _frame_stream_states[id]["total_frames"],
            # })

            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.001)
                # msg = await websocket.receive_json()
                command = msg.get("command")

                if command == "play":
                    _frame_stream_states[id]["is_playing"] = True
                elif command == "pause":
                    _frame_stream_states[id]["is_playing"] = False
                elif command == "stop":
                    break
                elif command == "seek":
                    frame = msg.get("frame", 0)
                    _frame_stream_states[id]["current_frame"] = max(0, min(frame, total_frames))
                elif command == "forward":
                    state = _frame_stream_states[id]
                    if state["current_frame"] < total_frames:
                        state["current_frame"] += 1
                elif command == "rewind":
                    state = _frame_stream_states[id]
                    if state["current_frame"] > 0:
                        state["current_frame"] -= 1

            except asyncio.TimeoutError:
                #               # No message received, continue streaming if playing
                pass
            # # Echo back the new state, only when a state change was observed, or a command was executed
            # check if _frame_stream_states[id] changed from what was set earlier

            # print(_frame_stream_states[id].get("current_frame"), frame_stream_state_id.get("current_frame"))
            if frame_stream_state_id != _frame_stream_states[id]:
                frame_stream_state_id = copy.copy(_frame_stream_states[id])
                # print("A state change was detected")
                # print(frame_stream_state_id.get("current_frame"))
                await websocket.send_json(
                    {
                        "type": "state",
                        "current_frame": _frame_stream_states[id]["current_frame"],
                        "is_playing": _frame_stream_states[id]["is_playing"],
                        "total_frames": total_frames,
                    }
                )

    except Exception as e:
        logger.error(f"Control WebSocket error: {e}")
    finally:
        if id in _frame_stream_states:
            del _frame_stream_states[id]
        conn_manager.disconnect(websocket)
