"""Router for the PiCamera interaction."""

import asyncio
import io
import time
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from orc_api.database import get_db
from orc_api.log import logger
from orc_api.routers.video import upload_video

# Initialize router
router = APIRouter(prefix="/pivideo_stream", tags=["pivideo_stream"])

# Globals for managing the camera
picam = None
camera_streaming = False


def start_camera(width: int = 1920, height: int = 1080, fps: int = 30):
    """Start the PiCamera with the specified width, height, and FPS."""
    try:
        from picamera2 import Picamera2  # Use 'from picamera import PiCamera' if using old library
    except ImportError:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    picam = Picamera2()
    video_config = picam.create_video_configuration(
        main={"size": (width, height)}, controls={"FrameDurationLimits": (int(1e6 / fps), int(1e6 / fps))}
    )
    picam.configure(video_config)
    picam.start()
    return picam


@router.get("/has_picam", response_model=bool)
async def has_picam():
    """Test if the PiCamera is available."""
    try:
        from picamera2 import Picamera2  # noqa
    except ImportError:
        return False
    else:
        return True


# Start video stream
@router.post("/start")
async def start_camera_stream(width: int = 1920, height: int = 1080, fps: int = 30):
    """Start the video stream with the specified width, height, and FPS."""
    global picam, camera_streaming
    logger.info(f"Starting camera stream with width: {width}, height: {height}, and FPS: {fps}")
    if camera_streaming:
        return {"message": "Camera stream was already available."}

    try:
        from picamera2 import Picamera2  # Use 'from picamera import PiCamera' if using old library  # noqa
    except ImportError:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    try:
        picam = start_camera(width, height, fps)
        camera_streaming = True
        return {
            "message": f"Camera stream started successfully with width: {width}, height: {height}, and FPS: {fps}. "
        }
    except Exception as e:
        logger.error(f"Problem with starting camera stream: {str(e)}")
        camera_streaming = False
        if picam is not None:
            picam.stop()
            picam.close()
        picam = None
        raise HTTPException(status_code=500, detail=f"Error starting camera stream: {str(e)}")


def record_async_task(db: Session, width: int = 1920, height: int = 1080, fps: int = 30, length: float = 5.0):
    """Record video for specified length in seconds."""
    # start a new camera
    picam = start_camera(width, height, fps)

    encoder = picam.create_encoder("h264", bitrate=20000000)
    stream = io.BytesIO()
    timestamp = datetime.now()
    picam.start_encoder(encoder=encoder, output=stream)
    # Record for specified duration
    time.sleep(length)

    # Stop recording
    picam.stop_encoder()
    picam.stop()
    # rewind IO
    stream.seek(0)
    file = UploadFile(filename=f"picam_{timestamp}.mkv", file=stream)
    # upload file into database using our existing router for uploading videos
    asyncio.run(upload_video(file=file, timestamp=timestamp, db=db))


@router.post("/record")
async def record_camera_stream(
    width: int = 1920,
    height: int = 1080,
    fps: int = 30,
    length: float = 5.0,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    """Record video for specified length in seconds."""
    global picam, camera_streaming
    if camera_streaming:
        # make sure we start a new stream with the right settings
        picam.stop()

    try:
        # Respond immediately to the client before executing the long-running task
        response = {"message": "Recording video started in the background", "status": "processing"}

        # Add the recording task in the background
        background_tasks.add_task(record_async_task, db=db, width=width, height=height, fps=fps, length=length)

        return response

    except Exception as e:
        if picam is not None:
            picam.stop_encoder()
            picam.stop()
        raise HTTPException(status_code=500, detail=f"Error during recording: {str(e)}")


# Stop video stream
@router.post("/stop")
async def stop_camera_stream():
    """Stop the video stream."""
    global picam, camera_streaming

    if not camera_streaming:
        raise HTTPException(status_code=400, detail="Camera stream is not currently running.")

    try:
        picam.stop()
        picam.close()
        camera_streaming = False
        picam = None
        return {"message": "Camera stream stopped successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error stopping camera stream: {str(e)}")


# Generator for streaming video frames (MJPEG)
def generate_camera_frames():
    """Generate video frames from the camera."""
    global picam
    if picam is None:
        logger.error("Camera instance is None. Start the stream first.")
        raise StopIteration
    while camera_streaming:
        stream = io.BytesIO()
        try:
            picam.capture_file(stream, format="jpeg")
            # Reset the pointer of the stream for yielding
            stream.seek(0)
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + stream.read() + b"\r\n")
        except Exception as e:
            logger.error(f"Error streaming frame: {str(e)}")
            break


# Stream endpoint
@router.get("/stream")
async def stream_camera_video():
    """Stream video frames from the camera (first start the stream)."""
    global camera_streaming
    if not camera_streaming:
        raise HTTPException(status_code=400, detail="Camera stream is not running. Start the stream first.")

    return StreamingResponse(generate_camera_frames(), media_type="multipart/x-mixed-replace; boundary=frame")


picam = None
camera_streaming = False
