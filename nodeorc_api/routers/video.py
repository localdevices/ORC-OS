import mimetypes
import os
from zipfile import ZIP_DEFLATED

import zipstream

from datetime import datetime
from fastapi import APIRouter, UploadFile, Form, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from nodeorc.db import Video
from sqlalchemy.orm import Session
from typing import Optional, List

from nodeorc_api.database import get_db
from nodeorc_api.schemas.video import VideoCreate, VideoResponse
from nodeorc_api.utils import create_thumbnail
from nodeorc_api import crud
router: APIRouter = APIRouter(prefix="/video", tags=["video"])
# Directory to save uploaded files
UPLOAD_DIRECTORY = "uploads"

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

# helpers
async def zip_generator(files):
    """Async generator to stream the zip file content."""
    z = zipstream.ZipFile(mode="w", compression=ZIP_DEFLATED)  #, compression=ZIP_DEFLATED  # 64KB chunks
    for f in files:
        if not os.path.isfile(f):
            print(f"File {f} does not exist. Skipping.")
            continue
        z.write(f, arcname=f)
    for chunk in z:
        yield chunk


@router.get("/{id}/thumbnail/", response_class=FileResponse, status_code=200)
async def get_thumbnail(id: int, db: Session = Depends(get_db)):
    """Retrieve a thumbnail for a video."""
    video = crud.video.get(db=db, id=id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    if not video.thumbnail:
        raise HTTPException(status_code=404, detail="Video is found, but thumbnail is not found.")
    # convert into schema and return data
    video = VideoResponse.model_validate(video)
    # Determine the MIME type of the file
    file_path = video.get_thumbnail(base_path=UPLOAD_DIRECTORY)
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"  # Fallback MIME type

    return FileResponse(video.get_thumbnail(base_path=UPLOAD_DIRECTORY), media_type=mime_type)

@router.get("/", response_model=List[VideoResponse], status_code=200)
async def get_list_video(
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Retrieve a thumbnail for a video."""
    list_videos = crud.video.get_list(db, start=start, stop=stop)
    return list_videos

@router.get("/{id}/", response_model=VideoResponse, status_code=200)
async def get_video(id: int, db: Session = Depends(get_db)):
    """Retrieve a thumbnail for a video."""
    video = crud.video.get(db=db, id=id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    return video

@router.delete("/{id}/", status_code=204, response_model=None)
async def delete_video(id: int, db: Session = Depends(get_db)):
    """Delete a video."""
    _ = crud.video.delete(db=db, id=id)
    return

@router.delete("/", status_code=204, response_model=None)
async def delete_list_videos(ids: List[int], db: Session = Depends(get_db)):
    """Delete a list of videos. """
    for id in ids:
        try:
            _ = crud.video.delete(db=db, id=id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    return

@router.get("/{id}/play/", response_class=FileResponse, status_code=200)
async def play_video(id: int, db: Session = Depends(get_db)):
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
        raise HTTPException(status_code=404, detail="Video file not found on local data store. Please check your upload directory and try again. If the problem persists, please contact the administrator for assistance.")

    # Determine the MIME type of the file based on the extension
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "video/mp4"  # Fallback MIME type for unknown files, if that fails, probably file is downloaded

    # Return the video file using FileResponse
    return FileResponse(file_path, media_type=mime_type)

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
        raise HTTPException(status_code=404, detail="Image file not found on local data store. Please check your upload directory and try again. If the problem persists, please contact the administrator for assistance.")

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
    camera_config: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    # validate the individual inputs
    video = VideoCreate(timestamp=timestamp, camera_config=camera_config)
    # Create a new Video instance to retrieve an id
    video_instance = Video(**video.model_dump())

    # Save to database
    db.add(video_instance)
    db.commit()
    db.refresh(video_instance)

    # now the video has an ID and we can create a logical storage location
    file_dir = os.path.join(UPLOAD_DIRECTORY, "videos", str(video_instance.id))
    os.makedirs(file_dir, exist_ok=True)
    # Save file to disk
    rel_file_path = os.path.join("videos", str(video_instance.id), file.filename)
    abs_file_path = os.path.join(UPLOAD_DIRECTORY, rel_file_path)
    with open(abs_file_path, "wb") as f:
        f.write(await file.read())
    # now make a thumbnail and store
    os.path.splitext(str(file.filename))[0]
    rel_thumb_path = os.path.join(
        "videos", str(video_instance.id),
        f"{os.path.splitext(str(file.filename))[0]}_thumb.jpg"
    )
    abs_thumb_path = os.path.join(UPLOAD_DIRECTORY, rel_thumb_path)
    thumb = create_thumbnail(abs_file_path)
    thumb.save(abs_thumb_path, "JPEG")

    # now update the video instance
    video_instance.file = rel_file_path
    video_instance.thumbnail = rel_thumb_path
    db.commit()

    # return a VideoResponse instance
    return VideoResponse.model_validate(video_instance)

@router.post("/download/", status_code=200, response_class=StreamingResponse)
async def download_videos(
    get_image: bool,
    get_video: bool,
    get_netcdfs: bool,
    get_log: bool,
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
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
            files_to_zip +=video.get_netcdf_files(base_path=UPLOAD_DIRECTORY)
        if get_log:
            # TODO: figure out default name for .log file and also return that
            pass
    print(files_to_zip)

    return StreamingResponse(
        zip_generator(files_to_zip),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'}
    )


@router.post("/download_ids/", status_code=200, response_class=StreamingResponse)
async def download_videos_on_ids(
    ids: List[int] = None,
    get_image: bool = True,
    get_video: bool = True,
    get_netcdfs: bool = True,
    get_log: bool = True,
    db: Session = Depends(get_db)
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
            files_to_zip +=video.get_netcdf_files(base_path=UPLOAD_DIRECTORY)
        if get_log:
            # TODO: figure out default name for .log file and also return that
            pass
    print(files_to_zip)
    files = [(os.path.basename(f), f) for f in files_to_zip]

    return StreamingResponse(
        zip_generator(files_to_zip),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="files.zip"'}
    )

