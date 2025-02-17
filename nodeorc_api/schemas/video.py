import glob
import os
from datetime import datetime

from nodeorc.db import TimeSeries
from pydantic import BaseModel, Field, ConfigDict
from nodeorc import db as models
from typing import Optional, Union

from nodeorc_api.schemas.time_series import TimeSeriesResponse, TimeSeriesBase

# Pydantic model for responses
class VideoBase(BaseModel):
    timestamp: datetime = Field(description="Timestamp of the video.")
    camera_config: Optional[int] = Field(description="Camera configuration ID.", default=None)

class VideoCreate(VideoBase):
    pass

class VideoResponse(VideoBase):
    id: int = Field(description="Video ID")
    file: Optional[str] = Field(default=None, description="File name of the video.")
    image: Optional[str] = Field(description="Image file name of the video.")
    thumbnail: Optional[str] = Field(default=None, description="Thumbnail file name of the video.")
    status: Optional[models.VideoStatus] = Field(default=models.VideoStatus.NEW, description="Status of the video.")
    time_series: Optional[Union[TimeSeriesResponse, TimeSeriesBase]] = TimeSeriesBase()
    sync_status: Optional[bool] = Field(default=None, description="Status of the video to LiveORC server.")
    remote_id: Optional[int] = Field(default=None, description="ID of video on LiveORC server.")
    site_id: Optional[int] = Field(default=None, description="ID of site to which video belongs on LiveORC server.")

    model_config = ConfigDict(from_attributes=True)
    def get_thumbnail(self, base_path: str):
        if self.thumbnail is None:
            return None
        return os.path.join(base_path, self.thumbnail)

    def get_video_file(self, base_path: str):
        if self.file is None:
            return None
        return os.path.join(base_path, self.file)

    def get_image_file(self, base_path: str):
        if self.image is None:
            return None
        return os.path.join(base_path, self.image)

    def get_netcdf_files(self, base_path: str):
        path = os.path.join(base_path, "OUTPUT", "*.nc")
        return glob.glob(path)


class DownloadVideosRequest(BaseModel):
    get_image: Optional[bool] = False
    get_video: Optional[bool] = False
    get_netcdfs: Optional[bool] = False
    get_log: Optional[bool] = False
    start: Optional[datetime] = None
    stop: Optional[datetime] = None

# Define the request body schema
class DeleteVideosRequest(BaseModel):
    start: datetime = None
    stop: datetime = None
