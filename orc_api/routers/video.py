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
from orc_api import __home__, crud
from orc_api.database import get_db
from orc_api.db import Video, VideoStatus
from orc_api.log import logger
from orc_api.schemas.video import (
    DeleteVideosRequest,
    DownloadVideosRequest,
    VideoCreate,
    VideoListResponse,
    VideoPatch,
    VideoResponse,
)
from orc_api.utils import queue, websockets
from orc_api.utils.states import video_run_state

router: APIRouter = APIRouter(prefix="/video", tags=["video"])


UPLOAD_DIRECTORY = os.path.join(__home__, "uploads")

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

# start an empty list of websocket connections
websocket_video_conns = []

# # Event used to notify state changes
# video_update_queue = asyncio.Queue()
#

# start a websockets connection manager
conn_manager = websockets.ConnectionManager()


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
    video = crud.video.get(db=db, id=id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    if not video.thumbnail:
        raise HTTPException(status_code=404, detail="Video record is found, but thumbnail is not found.")
    # convert into schema and return data
    video = VideoResponse.model_validate(video)
    # Determine the MIME type of the file
    file_path = video.get_thumbnail(base_path=UPLOAD_DIRECTORY)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Thumbnail file not found on local data store.")

    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"  # Fallback MIME type

    return FileResponse(file_path, media_type=mime_type)


@router.get("/{id}/frame/{frame_nr}", response_class=FileResponse, status_code=200)
async def get_frame(id: int, frame_nr: int, rotate: Optional[int] = None, db: Session = Depends(get_db)):
    """Retrieve single frame from video."""
    video_rec = crud.video.get(db=db, id=id)
    if not video_rec:
        raise HTTPException(status_code=404, detail="Video not found.")

    # Open the video file
    video = VideoResponse.model_validate(video_rec)
    if not video.file:
        raise HTTPException(status_code=404, detail="Video record is found, but video file is not found.")
    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)

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

    # Convert to VideoListResponse list (light-weight for front end use
    video_list_responses = [
        VideoListResponse.from_video_response(VideoResponse.model_validate(video)) for video in list_videos
    ]
    return video_list_responses


@router.get("/count/", response_model=int, status_code=200)
async def get_list_video_count(
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    status: Optional[Union[VideoStatus, int]] = Query(default=None),
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

    list_videos_count = crud.video.get_list_count(db, start=start, stop=stop, status=status, first=first, count=count)
    return list_videos_count


@router.get("/{id}/", response_model=VideoResponse, status_code=200)
async def get_video(id: int, db: Session = Depends(get_db)):
    """Retrieve metadata for a video."""
    video = crud.video.get(db=db, id=id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    return video


@router.get("/{id}/frame_count/", response_model=int, status_code=200)
async def get_video_end_frame(id: int, db: Session = Depends(get_db)):
    """Retrieve the end frame of a video."""
    video_rec = crud.video.get(db=db, id=id)
    if not video_rec:
        raise HTTPException(status_code=404, detail="Video not found.")

    # Open the video file
    video = VideoResponse.model_validate(video_rec)

    # open video
    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)

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
async def patch_video(id: int, video: VideoPatch, db: Session = Depends(get_db)):
    """Update a video in the database."""
    update_video = video.model_dump(exclude_none=True, exclude={"id", "video_config", "time_series"})
    video = crud.video.update(db=db, id=id, video=update_video)
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
    video = crud.video.get(db=db, id=id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")

    if not video.file:  # Assuming `file_path` is the attribute storing the video's path
        raise HTTPException(status_code=404, detail="Video file field not available.")
    # convert into schema and return data
    video = VideoResponse.model_validate(video)

    file_path = video.get_video_file(base_path=UPLOAD_DIRECTORY)
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


@router.get("/{id}/run", response_model=VideoPatch, status_code=200)
async def run_video(id: int, request: Request, db: Session = Depends(get_db)):
    """Retrieve a video file and stream it to the client."""
    video = crud.video.get(db=db, id=id)
    # make a Response video
    video = VideoResponse.model_validate(video)
    # now submit video to run process
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    executor = request.app.state.executor
    session = request.app.state.session
    video_patch = await queue.process_video_submission(
        session=session,
        video=video,
        logger=logger,
        executor=executor,
        upload_directory=UPLOAD_DIRECTORY,
    )
    return video_patch


@router.get("/{id}/image/", response_class=FileResponse, status_code=200)
async def get_image(id: int, db: Session = Depends(get_db)):
    """Retrieve an image result from video record."""
    video = crud.video.get(db=db, id=id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")

    if not video.image:  # Assuming `file_path` is the attribute storing the video's path
        raise HTTPException(status_code=404, detail="Image file field not available.")
    # convert into schema and return data
    video = VideoResponse.model_validate(video)

    file_path = video.get_image_file(base_path=UPLOAD_DIRECTORY)
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

    return StreamingResponse(
        zip_generator(files_to_zip, base_path=UPLOAD_DIRECTORY),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'},
    )


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
            print("Sending update to connected websockets")
            await conn_manager.send_json(websocket=websocket, json=status_msg)
            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        conn_manager.disconnect(websocket)

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        conn_manager.disconnect(websocket)
        await websocket.close()
