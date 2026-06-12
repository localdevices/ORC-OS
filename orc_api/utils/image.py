"""Image utilities for NodeORC API."""

import io

import cv2
from fastapi import HTTPException
from PIL import Image


def create_thumbnail(image_path: str, size=(50, 50)) -> Image:
    """Create thumbnail for image."""
    cap = cv2.VideoCapture(image_path)
    res, image = cap.read()
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(image)
    img.thumbnail(size, Image.LANCZOS)
    return img


def get_height_width(fn):
    """Get height and width of video or image."""
    cap = cv2.VideoCapture(fn)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    cap.release()
    del cap
    return height, width


def get_frame_count(fn):
    """Get frame count of video."""
    cap = cv2.VideoCapture(fn)
    # check amount of frames
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # if frame_count is negative, try to find out how many frames are available by reading all
    if frame_count < 0:
        ret = True
        n = 0
        while ret:
            ret, img = cap.read()
            if not ret:
                break
            n += 1
        # remove one frame just to make sure
        frame_count = n - 1
    cap.release()
    del cap
    return frame_count


def get_frame_from_cap(cap, rotate):
    """Get frame from video."""
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
    return success, io.BytesIO(buffer.tobytes())


def yield_frames_from_fn(fn, rotate, start_frame, end_frame):
    """Yield frames from video."""
    cap = cv2.VideoCapture(fn)
    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        current_frame = start_frame
        while True:
            # while current_frame <= end_frame:
            success, io_buf = get_frame_from_cap(cap, rotate)
            if not success:
                break
            io_buf.seek(0)
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + io_buf.read() + b"\r\n")
            current_frame += 1
            if current_frame == end_frame:
                # reset entirely. This is needed because files without metadata may not properly rewind!
                cap.release()
                del cap
                cap = cv2.VideoCapture(fn)
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
                current_frame = start_frame
    finally:
        cap.release()
        del cap
