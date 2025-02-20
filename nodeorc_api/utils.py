"""Utilities for NodeORC API"""
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