"""Video schema."""

import glob
import json
import os
from datetime import datetime
from typing import Optional

import numpy as np
import xarray as xr
from pydantic import BaseModel, ConfigDict, Field
from pyorc.service import velocity_flow

from orc_api import crud
from orc_api import db as models
from orc_api.database import get_session
from orc_api.log import logger
from orc_api.schemas.time_series import TimeSeriesResponse
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
    image: Optional[str] = Field(default=None, description="Image file name of the video.")
    thumbnail: Optional[str] = Field(default=None, description="Thumbnail file name of the video.")
    status: Optional[models.VideoStatus] = Field(default=models.VideoStatus.NEW, description="Status of the video.")
    time_series: Optional[TimeSeriesResponse] = Field(default=None, description="Time series attached to video.")
    sync_status: Optional[models.SyncStatus] = Field(
        default=models.SyncStatus.LOCAL, description="Status of the video to LiveORC server."
    )
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

    def run(self, base_path: str, prefix: str = ""):
        """Run video."""
        if not self.allowed_to_run:
            raise Exception("Cannot run video, prerequisites not met.")
        # assemble all information
        output = os.path.join(self.get_path(base_path=base_path), "output")
        cameraconfig = self.video_config.camera_config.data
        # get the rotated/translated cross-section
        cross_section_feats = self.video_config.cross_section_rt.features
        cross = os.path.join(self.get_path(base_path=base_path), "cross_section.geojson")
        with open(cross, "w") as f:
            json.dump(cross_section_feats, f)
        # get the recipe with any required fields filled
        recipe = self.video_config.recipe_transect_filled.data
        videofile = self.get_video_file(base_path=base_path)
        # find expected image file name
        rel_img_fn = None
        if "plot" in recipe:
            key = next(iter(recipe["plot"]))
            img_fn = os.path.join(self.get_path(base_path=base_path), "output", f"{key}.jpg")
            rel_img_fn = os.path.relpath(img_fn, base_path)
        # run the video with pyorc
        try:
            velocity_flow(
                recipe=recipe,
                videofile=videofile,
                cameraconfig=cameraconfig,
                prefix=prefix,
                output=output,
                h_a=self.time_series.h,
                cross=cross,
                logger=logger,
            )
        except Exception as e:
            self.status = models.VideoStatus.ERROR
            raise Exception(f"Error running video, response: {e}, VideoStatus is ERROR.")
        # afterwards, set to done
        self.image = rel_img_fn
        self.status = models.VideoStatus.DONE
        # update video model
        update_data = self.model_dump(exclude_unset=True, exclude={"id", "created_at", "video_config", "time_series"})
        crud.video.update(get_session(), id=self.id, video=update_data)
        # update time series
        self.update_timeseries(base_path=base_path)

    def get_path(self, base_path: str):
        """Get media path to video."""
        return os.path.split(self.get_video_file(base_path))[0]

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
        """Get list of netcdf files in output directory."""
        path = os.path.join(base_path, "output", "*.nc")
        return glob.glob(path)

    def get_discharge_file(self, base_path: str):
        """Get discharge file name."""
        fn = os.path.join(base_path, "output", "transect_transect_1.nc")
        if os.path.exists(fn):
            return fn
        else:
            return None

    def update_timeseries(self, base_path: str):
        """Get discharge data."""
        fn = self.get_discharge_file(base_path=base_path)
        if fn is None:
            return

        ds = xr.open_dataset(fn)
        h = float(ds.h_a)
        Q = np.abs(ds.river_flow.values)
        if "q_nofill" in ds:
            ds.transect.get_river_flow(q_name="q_nofill")
            Q_nofill = np.abs(ds.river_flow.values)
            perc_measured = Q_nofill / Q * 100  # fraction that is truly measured compared to total
        else:
            perc_measured = np.nan * Q
        update_data = {
            "h": h if np.isfinite(h) else None,
            "q_05": Q[0] if np.isfinite(Q[0]) else None,
            "q_25": Q[1] if np.isfinite(Q[1]) else None,
            "q_50": Q[2] if np.isfinite(Q[2]) else None,
            "q_75": Q[3] if np.isfinite(Q[3]) else None,
            "q_95": Q[4] if np.isfinite(Q[4]) else None,
            "fraction_velocimetry": perc_measured[2] if np.isfinite(perc_measured[2]) else None,
        }
        crud.time_series.update(get_session(), id=self.time_series.id, time_series=update_data)


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
