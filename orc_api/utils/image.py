"""Image utilities for NodeORC API."""

import cv2
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
