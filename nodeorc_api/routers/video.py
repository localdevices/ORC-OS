from fastapi import Response, Request, APIRouter
from fastapi.responses import StreamingResponse

import cv2

router: APIRouter = APIRouter(prefix="/video", tags=["video"])


@router.get("/feed/", response_class=StreamingResponse, description="Get video stream from user-defined URL")
async def video_feed(request: Request, video_url: str):
    async def generate_frames():
        if not video_url:
            raise ValueError("No video URL provided")
        cap = cv2.VideoCapture(video_url)
        print(f"VIDEO URL IS: {video_url}")
        if not cap.isOpened():
            # return Response("Unable to open RTSP stream", status_code=500)
            raise RuntimeError("Unable to open RTSP stream")

        try:
            from collections import deque
            frame_buffer = deque(maxlen=10)  # Adjust maxlen based on desired buffer size
            while True:
                if await request.is_disconnected():
                    break
                success, frame = cap.read()
                if not success:
                    break
                frame_buffer.append(frame)
                # Encode the frame as JPEG
                _, buffer = cv2.imencode(".jpg", frame_buffer.pop())

                # Yield the frame as part of an MJPEG stream
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
                )
                # Add a small delay to avoid overloading the server, probably not required.
                # await asyncio.sleep(0.03)
        finally:
            print("Releasing the video capture object")
            cap.release()
            del cap

    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@router.head("/feed/", response_class=Response, description="Check if the video feed in the user defined URL is available")
async def check_video_feed(response: Response, video_url: str):
    """
    HEAD endpoint to check if the video feed is available.
    """
    print(f"VIDEO URL IS: {video_url}")
    if not video_url:
        raise ValueError("No video URL provided")

    try:
        # RTSP_URL = "rtsp://nodeorcpi:8554/cam"
        cap = cv2.VideoCapture(video_url)

        if not cap.isOpened():
            return Response("Unable to open RTSP stream", status_code=500)
        else:
            return Response("Video feed is available", status_code=200)
    finally:
        cap.release()
        del cap

