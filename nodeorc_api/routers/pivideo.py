from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io

from threading import Thread

# Initialize router
router = APIRouter(prefix="/pivideo", tags=["pivideo"])

# Globals for managing the camera
picamera_instance = None
camera_streaming = False

@router.get("/has_picam", response_model=bool)
async def has_picam():
    """Test if the PiCamera is available."""
    try:
        from picamera import PiCamera
    except ImportError:
        return False
    else:
        return True

# Start video stream
@router.post("/start")
async def start_camera_stream():
    global picamera_instance, camera_streaming

    if camera_streaming:
        raise HTTPException(status_code=400, detail="Camera stream is already running.")

    try:
        from picamera2 import Picamera2  # Use 'from picamera import PiCamera' if using old library
    except ImportError:
        raise HTTPException(status_code=500, detail="picamera2 library is not installed.")
    try:
        picamera_instance = Picamera2()  # Replace with PiCamera() if using older picamera
        picamera_instance.configure(picamera_instance.create_preview_configuration())
        picamera_instance.start()
        camera_streaming = True
        return {"message": "Camera stream started successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting camera stream: {str(e)}")


# Stop video stream
@router.post("/stop")
async def stop_camera_stream():
    global picamera_instance, camera_streaming

    if not camera_streaming:
        raise HTTPException(status_code=400, detail="Camera stream is not currently running.")

    try:
        picamera_instance.stop()
        picamera_instance.close()
        camera_streaming = False
        picamera_instance = None
        return {"message": "Camera stream stopped successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error stopping camera stream: {str(e)}")


# Generator for streaming video frames (MJPEG)
def generate_camera_frames():
    global picamera_instance
    if picamera_instance is None:
        raise StopIteration

    while camera_streaming:
        stream = io.BytesIO()
        try:
            picamera_instance.capture_file(stream, format="jpeg")
            stream.seek(0)
            yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + stream.read() + b"\r\n"
            )
        except Exception as e:
            print(f"Error streaming frame: {str(e)}")
            break

# Stream endpoint
@router.get("/stream")
async def stream_camera_video():
    global camera_streaming
    if not camera_streaming:
        raise HTTPException(status_code=400, detail="Camera stream is not running. Start the stream first.")

    return StreamingResponse(generate_camera_frames(), media_type="multipart/x-mixed-replace; boundary=frame")



picamera_instance = None
camera_streaming = False
