import os
from pathlib import Path

import cv2
import numpy as np
import pytest

from orc_api.utils import image


@pytest.fixture
def tmp_video(tmpdir):
    # Create a temporary video file for testing
    test_video_path = Path(tmpdir) / "test_video.mp4"
    os.makedirs(test_video_path.parent, exist_ok=True)
    # Create a simple video with 10 frames of 320x240 pixels
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(test_video_path), fourcc, 30.0, (320, 240))
    for _ in range(10):
        frame = (255 * np.random.rand(240, 320, 3)).astype(np.uint8)
        out.write(frame)
    out.release()
    return test_video_path


def test_get_frame_count(tmp_video):
    frame_count = image.get_frame_count(tmp_video)
    assert frame_count == 10


def test_create_thumbnail(tmp_video):
    thumbnail = image.create_thumbnail(tmp_video)
    assert thumbnail.size == (50, 38)


def test_get_height_width(tmp_video):
    height, width = image.get_height_width(tmp_video)
    assert height == 240
    assert width == 320


@pytest.mark.parametrize(("rotate", "height"), [(None, 240), (90, 320)])
def test_get_frame_from_cap(tmp_video, rotate, height):
    cap = cv2.VideoCapture(tmp_video)
    success, frame = image.get_frame_from_cap(cap, rotate=rotate)
    assert success
    assert frame is not None
    # frame is a jpg BytesIO object, read and check numpy array height
    frame.seek(0)
    frame_bytes = frame.read()
    nparr = np.frombuffer(frame_bytes, np.uint8)
    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    assert img_np.shape[0] == height
    cap.release()


def test_yield_frames_from_fn_with_reset(tmp_video):
    # Test that yield_frames_from_fn resets when current_frame == end_frame
    # tmp_video has 10 frames (0-9), so end_frame=10, start_frame=9
    start_frame = 9
    end_frame = 10

    generator = image.yield_frames_from_fn(tmp_video, rotate=None, start_frame=start_frame, end_frame=end_frame)

    # Get first frame (current_frame becomes 10, triggering reset condition)
    frame1 = next(generator)
    assert frame1 is not None
    assert b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" in frame1

    # After reset, we should be back at start_frame=9, get another frame
    frame2 = next(generator)
    assert frame2 is not None
    assert b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" in frame2

    # Verify that we can continue yielding after reset
    frame3 = next(generator)
    assert frame3 is not None
    assert b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" in frame3
