"""Model for water level time series."""

import enum
import os
import shutil
from datetime import datetime
from typing import Optional

import cv2
from PIL import Image
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orc_api import UPLOAD_DIRECTORY
from orc_api.db import RemoteBase


def create_thumbnail(image_path: str, size=(50, 50)) -> Image:
    """Create thumbnail for image."""
    cap = cv2.VideoCapture(image_path)
    res, image = cap.read()
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(image)
    img.thumbnail(size, Image.LANCZOS)
    return img


class VideoStatus(enum.Enum):
    """Status of video as Enum."""

    NEW = 1
    QUEUE = 2
    TASK = 3
    DONE = 4
    ERROR = 5


class Video(RemoteBase):
    """Represents a video entity in the database.

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
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(), index=True)
    status: Mapped[enum.Enum] = mapped_column(Enum(VideoStatus), default=VideoStatus.NEW, index=True)
    file: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    image: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    thumbnail: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    video_config_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("video_config.id"), nullable=True
    )  # relate by id
    # time_series = Column(ForeignKey("time_series.id"))
    video_config = relationship("VideoConfig", foreign_keys=[video_config_id])
    time_series_id: Mapped[int] = mapped_column(Integer, ForeignKey("time_series.id"), nullable=True, unique=True)
    time_series = relationship("TimeSeries", uselist=False, back_populates="video")  # , foreign_keys=[time_series_id]

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


@event.listens_for(Video, "before_insert")
def add_water_level(mapper, connection, target):
    """Add water level to time series."""
    from orc_api import crud
    from orc_api.db import Session

    db = Session(bind=connection)
    # check if a record is available
    settings = crud.settings.get(db)
    timestamp = datetime.now() if not target.timestamp else target.timestamp
    timeseries_record = crud.time_series.get_closest(
        db,
        timestamp,
        allowed_dt=settings.allowed_dt,
    )
    if timeseries_record:
        # link the time series with target
        target.time_series_id = timeseries_record.id
    else:
        print(f"No water level record available for timestamp {timestamp.strftime('%Y-%m-%dT%H:%M:%S')}.")
