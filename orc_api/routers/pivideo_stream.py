"""Router for the PiCamera interaction."""

import asyncio
import io
import os
import time
from datetime import datetime
from typing import Dict, List, Union

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

try:
    from picamera2 import Picamera2  # Use 'from picamera import PiCamera' if using old library
    from picamera2.encoders import H264Encoder
    from picamera2.outputs import FfmpegOutput

    picam_available = True
except Exception:
    picam_available = False


def start_camera(width: int = 1920, height: int = 1080, fps: int = 30):
    """Start the PiCamera with the specified width, height, and FPS."""
    global picam_available
    if not picam_available:
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
    global picam_available
    return picam_available


@router.get("/picam_info", response_model=Union[List[Dict], None])
async def picam_info():
    """Return list of connected cameras with dict of camera info."""
    global picam_available
    if not picam_available:
        return None
    cameras = Picamera2.global_camera_info()
    print(cameras)
    if not cameras:
        return None
    return cameras


# Start video stream
@router.post("/start")
async def start_camera_stream(width: int = 1920, height: int = 1080, fps: int = 30):
    """Start the video stream with the specified width, height, and FPS."""
    global picam, camera_streaming, picam_available
    if not picam_available:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    logger.info(f"Starting camera stream with width: {width}, height: {height}, and FPS: {fps}")
    if camera_streaming:
        return {"message": "Camera stream was already available."}

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
    global picam, picam_available, camera_streaming
    if not picam_available:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    timestamp = datetime.now()
    filename = f"picam_{timestamp.strftime('%Y%m%dT%H%M%S')}.mkv"
    picam = start_camera(width, height, fps)
    # wait 1 second to warm up sensor
    time.sleep(1)
    camera_streaming = True
    output = FfmpegOutput(filename)
    encoder = H264Encoder(bitrate=20000000)
    picam.start_recording(encoder=encoder, output=output)
    # Record for specified duration
    time.sleep(length)

    # Stop recording
    picam.stop_encoder()
    picam.stop()
    picam.close()
    camera_streaming = False
    with open(filename, "rb") as f:
        buf = io.BytesIO(f.read())
        buf.seek(0)
    # now we can safely remove the file
    os.unlink(filename)
    file = UploadFile(filename=filename, file=buf)
    # upload file into database using our existing router for uploading videos
    asyncio.run(upload_video(file=file, timestamp=timestamp, video_config_id=None, db=db))


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
    global picam, camera_streaming, picam_available
    if not picam_available:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    if camera_streaming:
        # make sure we start a new stream with the right settings
        picam.stop()
        camera_streaming = False
    if picam is not None:
        picam.close()
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
    global camera_streaming, picam_available
    if not picam_available:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    if not camera_streaming:
        raise HTTPException(status_code=400, detail="Camera stream is not running. Start the stream first.")
    return StreamingResponse(generate_camera_frames(), media_type="multipart/x-mixed-replace; boundary=frame")


picam = None
camera_streaming = False
