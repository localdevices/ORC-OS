"""Router for the PiCamera interaction."""

import io
import tempfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

# Initialize router
router = APIRouter(prefix="/pivideo_stream", tags=["pivideo_stream"])

# Globals for managing the camera
picam = None
camera_streaming = False


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
async def start_camera_stream(width: int = 640, height: int = 480, fps: int = 5):
    """Start the video stream with the specified width, height, and FPS."""
    global picam, camera_streaming

    if camera_streaming:
        return {"message": "Camera stream was already available."}

    try:
        from picamera2 import Picamera2  # Use 'from picamera import PiCamera' if using old library
    except ImportError:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    try:
        picam = Picamera2()  # Replace with PiCamera() if using older picamera
        video_config = picam.create_video_configuration(
            main={"size": (width, height)}, controls={"FrameDurationLimits": (int(1e6 / fps), int(1e6 / fps))}
        )
        picam.configure(video_config)
        picam.start()
        camera_streaming = True
        return {
            "message": f"Camera stream started successfully with width: {width}, height: {height}, and FPS: {fps}. "
        }
    except Exception as e:
        camera_streaming = False
        if picam is not None:
            picam.stop()
            picam.close()
        picam = None
        raise HTTPException(status_code=500, detail=f"Error starting camera stream: {str(e)}")


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
        print("ERROR: Camera instance is None. Start the stream first.")
        raise StopIteration

    while camera_streaming:
        stream = io.BytesIO()
        try:
            picam.capture_file(stream, format="jpeg")
            stream.seek(0)

            # Save the frame to a temporary file (for debugging purposes)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg", dir="/tmp") as temp_file:
                temp_file.write(stream.read())
                print(f"Saved frame to temporary file: {temp_file.name}")

            # Reset the pointer of the stream for yielding
            stream.seek(0)

            print("Yielding a frame...")
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + stream.read() + b"\r\n")
        except Exception as e:
            print(f"Error streaming frame: {str(e)}")
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
