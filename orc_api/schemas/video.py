"""Video schema."""

import glob
import os
from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from orc_api import crud
from orc_api import db as models
from orc_api.database import get_session
from orc_api.schemas.time_series import TimeSeriesBase, TimeSeriesResponse
from orc_api.schemas.video_config import VideoConfigBase


# Pydantic model for responses
class VideoBase(BaseModel):
    """Base schema for video."""

    timestamp: datetime = Field(description="Timestamp of the video.")
    video_config_id: Optional[int] = Field(description="Video configuration ID.", default=None)
    video_config: Optional[VideoConfigBase] = Field(description="Video configuration.", default=None)


class VideoCreate(VideoBase):
    """Request body schema for creating video."""

    pass


class VideoResponse(VideoBase):
    """Response schema for video."""

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

    @property
    def ready_to_run(self):
        """Must be called by AP scheduler to check if video is ready to run."""
        # if the video has already been run, or is already in process, also return False
        if not self.status == models.VideoStatus.NEW:
            return False
        # check if all run components are available
        return self.allowed_to_run

    @property
    def allowed_to_run(self):
        """Check if prerequisites are met for running video."""
        # if there is no video config, return False immediately
        if self.video_config is None:
            return False
        if self.time_series:
            if self.time_series.h:
                return True
        # more complicated case, if there is optical, a cross section must be present!
        db = get_session()
        water_level_settings = crud.water_level.get(db)
        if water_level_settings is None:
            optical = False
        else:
            optical = water_level_settings.optical
        if not optical:
            # we are not allowed to try optical water levels, so return False
            return False
        # we are allowed optical, so check if there is a cross section
        return self.video_config.cross_section is not None

    def run(self):
        """Run video."""
        if not self.allowed_to_run:
            raise Exception("Cannot run video, prerequisites not met.")
        # assemble all information

        # run with separate instance
        pass

    def get_thumbnail(self, base_path: str):
        """Get thumbnail file name."""
        if self.thumbnail is None:
            return None
        return os.path.join(base_path, self.thumbnail)

    def get_video_file(self, base_path: str):
        """Get video file name."""
        if self.file is None:
            return None
        return os.path.join(base_path, self.file)

    def get_image_file(self, base_path: str):
        """Get image file name."""
        if self.image is None:
            return None
        return os.path.join(base_path, self.image)

    def get_netcdf_files(self, base_path: str):
        """Get list of netcdf files in OUTPUT directory."""
        path = os.path.join(base_path, "OUTPUT", "*.nc")
        return glob.glob(path)


class DownloadVideosRequest(BaseModel):
    """Request body schema for downloading videos."""

    get_image: Optional[bool] = False
    get_video: Optional[bool] = False
    get_netcdfs: Optional[bool] = False
    get_log: Optional[bool] = False
    start: Optional[datetime] = None
    stop: Optional[datetime] = None


# Define the request body schema
class DeleteVideosRequest(BaseModel):
    """Request body schema for deleting videos."""

    start: datetime = None
    stop: datetime = None
