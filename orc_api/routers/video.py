"""Video routers."""

import asyncio
import io
import mimetypes
import os
from datetime import datetime
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
from orc_api import UPLOAD_DIRECTORY, crud
from orc_api.database import get_db
from orc_api.db import SyncStatus, Video, VideoStatus
from orc_api.log import logger
from orc_api.routers.ws.video_config import WSVideoConfigMsg, WSVideoConfigState
from orc_api.schemas.camera_config import CameraConfigResponse
from orc_api.schemas.recipe import RecipeResponse
from orc_api.schemas.video import (
    DeleteVideosRequest,
    DownloadVideosRequest,
    SyncVideosRequest,
    VideoCreate,
    VideoListResponse,
    VideoPatch,
    VideoResponse,
)
from orc_api.schemas.video_config import VideoConfigResponse
from orc_api.utils import queue, websockets
from orc_api.utils.states import video_run_state

router: APIRouter = APIRouter(prefix="/video", tags=["video"])

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

# start a websockets connection manager
conn_manager = websockets.ConnectionManager()


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
            print(f"File {f} does not exist. Skipping.")
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
    success, frame = cap.read()
    if not success:
        raise HTTPException(status_code=500, detail="Failed to read frame")

    # Validate and apply rotation if specified
    if rotate is not None:
        if rotate not in [90, 180, 270]:
            raise HTTPException(status_code=400, detail="Rotation must be None, 90, 180 or 270 degrees")
        if rotate == 90:
            frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        elif rotate == 180:
            frame = cv2.rotate(frame, cv2.ROTATE_180)
        elif rotate == 270:
            frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)

    # Convert the frame to jpg format
    _, buffer = cv2.imencode(".jpg", frame)
    io_buf = io.BytesIO(buffer.tobytes())
    # Clean up
    cap.release()

    # Return the frame as a streaming response
    return StreamingResponse(io_buf, media_type="image/jpeg")


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
    cap = cv2.VideoCapture(file_path)
    # check amount of frames
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    return frame_count


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
    """Retrieve a video file and stream it to the client."""
    video = get_video_record(db, id)
    executor = request.app.state.executor
    # session = request.app.state.session
    video_patch = await queue.process_video(
        session=db,
        video=video,
        logger=logger,
        executor=executor,
        upload_directory=UPLOAD_DIRECTORY,
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
    # validate the individual inputs
    video = VideoCreate(timestamp=timestamp, video_config_id=video_config_id)
    # Create a new Video instance to retrieve an id
    video_instance = Video(**video.model_dump(exclude_none=True))

    # Save to database
    video_instance = crud.video.add(db=db, video=video_instance)

    # now the video has an ID and we can create a logical storage location
    file_dir = os.path.join(UPLOAD_DIRECTORY, "videos", timestamp.strftime("%Y%m%d"), str(video_instance.id))
    os.makedirs(file_dir, exist_ok=True)
    # Save file to disk
    rel_file_path = os.path.join("videos", timestamp.strftime("%Y%m%d"), str(video_instance.id), file.filename)
    abs_file_path = os.path.join(UPLOAD_DIRECTORY, rel_file_path)

    # Save the file in chunks
    with open(abs_file_path, "wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)  # Read in 1MB chunks
            if not chunk:
                break  # Stop when no more data is left
            f.write(chunk)

    # now update the video instance
    video_instance.file = rel_file_path
    # video_instance.thumbnail = rel_thumb_path
    db.commit()
    db.refresh(video_instance)
    # return a VideoResponse instance
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

    # retrieve the executor instance
    executor = request.app.state.executor
    video_patch = await queue.sync_video(
        session=db,
        video=video,
        logger=logger,
        site=callback_url.remote_site_id,
        sync_file=sync_file,
        sync_image=sync_image,
        executor=executor,
        upload_directory=UPLOAD_DIRECTORY,
    )
    return video_patch


@router.post("/sync/", status_code=200, response_model=List[VideoResponse])
async def sync_list_videos(request: Request, params: SyncVideosRequest, db: Session = Depends(get_db)):
    """Sync a list of videos."""
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
    timeout = min(url.retry_timeout, 150) if url.retry_timeout else 150
    try:
        videos = await queue.sync_videos_start_stop(
            session=db,
            executor=request.app.state.executor,
            upload_directory=UPLOAD_DIRECTORY,
            start=start,
            stop=stop,
            logger=logger,
            site=site,
            sync_file=sync_file,
            sync_image=sync_image,
            timeout=timeout,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error syncing videos: {str(e)}")
    msg = f"{len(videos)} videos submitted for syncing to site {site}."
    logger.info(msg)
    return videos


@router.websocket("/status/")
async def update_video_ws(websocket: WebSocket):
    """Get continuous status of the update process via websocket."""
    await conn_manager.connect(websocket)
    print(f"Connected websocket: {websocket}")
    await conn_manager.send_json(websocket=websocket, json=video_run_state.json)

    try:
        while True:
            # then just wait until the message changes
            status_msg = await video_run_state.queue.get()
            await conn_manager.send_json(websocket=websocket, json=status_msg)
            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        f"Websocket {websocket} disconnected."
        conn_manager.disconnect(websocket)


@router.websocket("/{id}/video_config_ws/")
async def video_config_ws(websocket: WebSocket, id: int, name: Optional[str] = None):
    """Get continuous status of video config belonging to video via websocket."""
    await conn_manager.connect(websocket)
    print(f"Connected websocket for video config data exchange: {websocket}")
    # initialize the websocket state
    try:
        db = next(get_db())
        video_rec = crud.video.get(db=db, id=id)
        video = VideoResponse.model_validate(video_rec)
        if video.video_config_id is None:
            if name is None:
                raise HTTPException(
                    status_code=400, detail='For a new video config, "name" must be provided as query param.'
                )
            vc = VideoConfigResponse(name=name)
            isSaved = False
        else:
            # make into VideoConfigResponse
            vc = video.video_config
            isSaved = True
        # check if recipe is None, if so make a default recipe
        if vc.recipe is None:
            vc.recipe = RecipeResponse(name=vc.name)
        if vc.camera_config is None:
            # initialize camera config with default values
            height, width = video.dims(base_path=UPLOAD_DIRECTORY)
            vc.camera_config = CameraConfigResponse(name=vc.name, data={"height": height, "width": width})
        # create a state for the rest of the session
        vc_state = WSVideoConfigState(vc=vc, saved=isSaved)
        db.close()
        await websocket.send_json(vc_state.model_dump(mode="json"))

    except Exception as e:
        await websocket.send_json({"error": str(e)})
        print(f"Error sending video config data to websocket: {e}")
        await websocket.close()
        return

    try:
        while True:
            # read requests from client
            msg = await websocket.receive_json()
            print(f"Received message from websocket: {msg}")
            # validate message
            msg = WSVideoConfigMsg.model_validate(msg)
            # perform operations on video config
            if msg.action == "save":
                r = vc_state.save()
            elif msg.action == "reset":
                r = vc_state.reset()
            elif msg.action == "update":
                # update with the operation and parameters only
                r = vc_state.update(**msg.model_dump(exclude={"action"}))
            await websocket.send_json(r.model_dump(mode="json"))
    except WebSocketDisconnect:
        print(f"Websocket {websocket} for video_config_id {id} disconnected.")
        await websocket.close()
    except Exception as e:
        print(f"Websocket error: {e}")
    finally:
        await websocket.close()
