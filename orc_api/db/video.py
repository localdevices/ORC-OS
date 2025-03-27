"""Model for water level time series."""
import cv2
import enum
import os
import shutil

from datetime import datetime
from PIL import Image
from sqlalchemy import Integer, DateTime, ForeignKey, String, Enum, event
from sqlalchemy.orm import relationship, mapped_column, Mapped
from orc_api import __home__
from orc_api.db import RemoteBase
from typing import Optional

UPLOAD_DIRECTORY = os.path.join(__home__, "uploads")

def create_thumbnail(image_path: str, size=(50, 50)) -> Image:
    """Create thumbnail for image."""
    cap = cv2.VideoCapture(image_path)
    res, image = cap.read()
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(image)
    img.thumbnail(size, Image.LANCZOS)
    return img


class VideoStatus(enum.Enum):
    NEW = 1
    QUEUE = 2
    TASK = 3
    DONE = 4
    ERROR = 5


class Video(RemoteBase):
    """
    Represents a video entity in the database.

    This class corresponds to the 'video' table in the database and provides
    fields to store metadata about a video, including timestamps, file details,
    thumbnail, and associated camera configuration. It is used to encapsulate
    the properties and attributes of video records.

    Attributes
    ----------
    __tablename__ : str
        Name of the database table ('video').
    id : int
        Primary key of the video record.
    timestamp : datetime
        The timestamp indicating when the video record was created.
    file : str or None
        The file associated with the video. Can be null.
    image : str or None
        The image associated with the video. Can be null.
    thumbnail : str or None
        The thumbnail of the video. Can be null.
    camera_config : int
        Foreign key linking to the associated camera configuration.
    """
    __tablename__ = "video"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now())
    status: Mapped[enum.Enum] = mapped_column(Enum(VideoStatus), default=VideoStatus.NEW)
    file: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    image: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    thumbnail: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    camera_config_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("camera_config.id"), nullable=True)  # relate by id
    # time_series = Column(ForeignKey("time_series.id"))
    camera_config = relationship("CameraConfig")
    time_series = relationship("TimeSeries", uselist=False, back_populates="video")

    def __str__(self):
        return "{}: {}".format(self.timestamp, self.file)

    def __repr__(self):
        return "{}".format(self.__str__())

@event.listens_for(Video, "before_insert")
@event.listens_for(Video, "before_update")
def create_thumbnail_listener(mapper, connection, target):
    """Create a thumbnail if this does not yet exist."""
    if target.file and not target.thumbnail:
        # now make a thumbnail and store
        rel_thumb_path = f"{os.path.splitext(target.file)[0]}_thumb.jpg"
        abs_file_path = os.path.join(UPLOAD_DIRECTORY, target.file)
        abs_thumb_path = os.path.join(UPLOAD_DIRECTORY, rel_thumb_path)
        # only if we are 100% sure the video file exists, we create a thumb
        if os.path.exists(abs_file_path):
            thumb = create_thumbnail(abs_file_path)
            thumb.save(abs_thumb_path, "JPEG")
            target.thumbnail = rel_thumb_path

@event.listens_for(Video, "before_delete")
def delete_files_listener(mapper, connection, target):
    """Delete files associated with this video."""
    target_path = os.path.split(os.path.join(UPLOAD_DIRECTORY, target.file))[0]
    if os.path.exists(target_path):
        # remove entire path
        shutil.rmtree(target_path)
