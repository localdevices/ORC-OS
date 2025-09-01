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
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api import db as models
from orc_api.database import get_session
from orc_api.log import logger
from orc_api.schemas.base import RemoteModel
from orc_api.schemas.time_series import TimeSeriesResponse
from orc_api.schemas.video_config import VideoConfigBase, VideoConfigResponse


# Pydantic model for responses
class VideoBase(BaseModel):
    """Base schema for video."""

    timestamp: datetime = Field(description="Timestamp of the video.")
    video_config_id: Optional[int] = Field(description="Video configuration ID.", default=None)
    video_config: Optional[VideoConfigBase] = Field(description="Video configuration.", default=None)


class VideoListResponse(BaseModel):
    """Lightweight response schema for the video list."""

    id: int
    timestamp: datetime
    file: Optional[str]
    video_config: Optional[dict]  # Contains only `id` and `name`
    time_series: Optional[TimeSeriesResponse]
    allowed_to_run: bool
    status: Optional[models.VideoStatus]

    @classmethod
    def from_video_response(cls, video_response: "VideoResponse") -> "VideoListResponse":
        """Create a VideoListResponse from a VideoResponse."""
        allowed_to_run, _ = video_response.allowed_to_run  # Extract truth value
        video_config_data = (
            {
                "id": video_response.video_config.id,
                "name": video_response.video_config.name,
                "sample_video_id": video_response.video_config.sample_video_id,
                "ready_to_run": video_response.video_config.ready_to_run,
            }
            if video_response.video_config
            else None
        )

        return cls(
            id=video_response.id,
            file=video_response.file,
            timestamp=video_response.timestamp,
            video_config=video_config_data,
            allowed_to_run=allowed_to_run,
            time_series=video_response.time_series if video_response.time_series else None,
            status=video_response.status if video_response.status else None,
        )


class VideoCreate(VideoBase):
    """Request body schema for creating video."""

    pass


class VideoResponse(VideoBase, RemoteModel):
    """Response schema for video."""

    id: int = Field(description="Video ID")
    file: Optional[str] = Field(default=None, description="File name of the video.")
    image: Optional[str] = Field(default=None, description="Image file name of the video.")
    thumbnail: Optional[str] = Field(default=None, description="Thumbnail file name of the video.")
    status: Optional[models.VideoStatus] = Field(default=models.VideoStatus.NEW, description="Status of the video.")
    time_series: Optional[TimeSeriesResponse] = Field(default=None, description="Time series attached to video.")
    time_series_id: Optional[int] = Field(default=None, description="ID of time series attached to video.")
    video_config: Optional[VideoConfigResponse] = Field(description="Video configuration.", default=None)
    model_config = ConfigDict(from_attributes=True)

    @property
    def ready_to_run(self):
        """Must be called by AP scheduler to check if video is ready to run."""
        # if the video has already been run, or is already in process, also return False
        if self.status in [models.VideoStatus.QUEUE, models.VideoStatus.TASK]:
            return False, "Video already in process or queued for processing."
        # check if all run components are available
        return self.allowed_to_run

    def ready_to_sync(self, site=None):
        """Check if video can be synced or not.

        This requires a site ID to be provided. It will be checked if the site id is available in the database.
        If the site is not available, False is returned. If the site is available, True is returned.
        """

    @property
    def allowed_to_run(self):
        """Check if prerequisites are met for running video."""
        # if there is no video config, return False immediately
        if self.video_config is None:
            return False, "No video config available."
        if self.time_series:
            if self.time_series.h:
                return True, "Ready"
        if self.video_config.cross_section_wl is None:
            return (
                False,
                "No time series set, and no water level cross section available, required for optical water levels. "
                "Please add one using the UI or API.",
            )
        else:
            return True, "Ready"

    def run(self, session: Session, base_path: str, prefix: str = ""):
        """Run video."""
        # update state first
        try:
            # with get_session() as session:
            rec = crud.video.get(session, id=self.id)
            rec.status = models.VideoStatus.TASK
            session.commit()
            session.refresh(rec)
            if self.time_series:
                # for older versions (python 3.9) check and validate
                self.time_series = TimeSeriesResponse.model_validate(self.time_series)
            allowed_to_run, msg = self.allowed_to_run
            if not allowed_to_run:
                raise Exception(msg)

            # check for h_a
            h_a = None if self.time_series is None else self.time_series.h
            logger.debug(f"Checked for water level in time series, found {h_a}")

            # overrule with set level if the video configuration is made with the current video
            if self.video_config.sample_video_id == self.id:
                logger.debug("Overruling water level because video is a sample video for the video configuration.")
                h_a = self.video_config.camera_config.gcps.h_ref

            # assemble all information
            logger.info(f"Water level set to {h_a}")
            output = os.path.join(self.get_path(base_path=base_path), "output")
            cameraconfig = self.video_config.camera_config.data.model_dump()
            # get the rotated/translated cross-section
            cross_section_feats = self.video_config.cross_section_rt.features
            # dump the used features in the output path of the video
            cross = os.path.join(self.get_path(base_path=base_path), "cross_section.geojson")
            with open(cross, "w") as f:
                json.dump(cross_section_feats, f)
            # if h_a is not available and a cross section is available, then make a cross section file for water level
            if h_a is None and self.video_config.cross_section_wl:
                cross_section_wl_feats = self.video_config.cross_section_wl_rt.features
                cross_wl = os.path.join(self.get_path(base_path=base_path), "cross_section_wl.geojson")
                with open(cross_wl, "w") as f:
                    json.dump(cross_section_wl_feats, f)
            else:
                cross_wl = None
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
            velocity_flow(
                recipe=recipe,
                videofile=videofile,
                cameraconfig=cameraconfig,
                prefix=prefix,
                output=output,
                h_a=h_a,
                cross=cross,
                cross_wl=cross_wl,
                logger=logger,
            )
            self.image = rel_img_fn
            # update time series (before video, in case time series with optical water level is added in the process
            self.update_timeseries(base_path=base_path)
            # update status
            self.status = models.VideoStatus.DONE
        except Exception as e:
            # ensure status is ERROR, but continue afterwards
            self.status = models.VideoStatus.ERROR
            logger.error(f"Error running video, response: {e}, VideoStatus set to ERROR.")
        update_data = self.model_dump(exclude_unset=True, exclude={"id", "created_at", "video_config", "time_series"})
        if self.time_series:
            update_data["time_series_id"] = self.time_series.id
        # with get_session() as session:
        crud.video.update(session, id=self.id, video=update_data)
        # check if remote syncing is possible.
        # This requires a fully configured callback_url including a site to report on
        callback_url = crud.callback_url.get(session)
        settings = crud.settings.get(session)
        # only in daemon mode attempt to sync automatically
        if callback_url and settings.remote_site_id:
            try:
                logger.debug("Attempting syncing to remote site ")
                # try the callback
                self.sync_remote(
                    session=session,
                    base_path=base_path,
                    site=settings.remote_site_id,
                    sync_file=settings.sync_file,
                    sync_image=settings.sync_image,
                )
                logger.info(f"Syncing to remote site {settings.remote_site_id} successful.")
            except Exception as e_sync:
                logger.error(f"Error syncing video to remote site: {e_sync}")
        if self.status == models.VideoStatus.ERROR:
            raise Exception("Error running video, VideoStatus set to ERROR.")
        return

    def sync_remote(self, session: Session, base_path: str, site: int, sync_file: bool = True, sync_image: bool = True):
        """Send the recipe to LiveORC API.

        Recipes belong to an institute, hence also the institute ID is required.
        """
        # first check if the recipe and cross section are synced
        if self.video_config is not None:
            if self.video_config.sync_status != models.SyncStatus.SYNCED:
                # first sync/update recipe
                self.video_config = self.video_config.sync_remote(session=session, site=site)
                self.video_config_id = self.video_config.id
        if self.time_series is not None:
            if self.time_series.sync_status != models.SyncStatus.SYNCED:
                self.time_series = self.time_series.sync_remote(session=session, site=site)
                self.time_series_id = self.time_series.id

        # now report the entire video config (this currently reports to cameraconfig,
        # should be updated after LiveORC restructuring)
        if self.remote_id is None:
            # committing a new video always occurs on a central end point (not site specific)
            endpoint = "/api/video/"
        else:
            # video can only be changed under the site end point
            endpoint = f"api/site/{site}/video/"
        data = {
            "timestamp": self.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "camera_config": self.video_config.remote_id,
            "status": self.status.value,
        }
        if self.created_at:
            data["created_at"] = self.created_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        if self.time_series:
            data["time_series"] = self.time_series.remote_id  # only if time series is available
        # make a dict for files to send
        files = {}
        if self.file and os.path.exists(self.get_video_file(base_path=base_path)) and sync_file:
            files["file"] = (self.file, open(self.get_video_file(base_path=base_path), "rb"))
        if self.image and os.path.exists(self.get_image_file(base_path=base_path)) and sync_image:
            files["image"] = (self.image, open(self.get_image_file(base_path=base_path), "rb"))
        # we take a little bit longer to try and sync the video (15sec time out instead of 5sec)
        response_data = super().sync_remote(session=session, endpoint=endpoint, data=data, files=files, timeout=60)
        if response_data is not None:
            response_data.pop("camera_config", None)
            response_data.pop("created_at", None)
            response_data.pop(
                "file", None
            )  # remove all refs to file media, as these are different on the remote server
            response_data.pop("image", None)
            response_data.pop("keyframe", None)
            response_data.pop("thumbnail", None)
            response_data.pop("project", None)
            response_data.pop("time_series", None)
            response_data.pop("creator", None)
            response_data["video_config_id"] = self.video_config_id
            response_data["time_series_id"] = self.time_series_id
            # patch the record in the database, where necessary
            # update schema instance
            update_video = VideoResponse.model_validate(response_data)
            r = crud.video.update(
                session, id=self.id, video=update_video.model_dump(exclude_unset=True, exclude_none=True)
            )
            return VideoResponse.model_validate(r)
        return None

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
        path = os.path.join(self.get_path(base_path=base_path), "output", "*.nc")
        return glob.glob(path)

    def get_discharge_file(self, base_path: str):
        """Get discharge file name."""
        fn = os.path.join(self.get_path(base_path=base_path), "output", "transect_transect_1.nc")
        if os.path.exists(fn):
            return fn
        else:
            return None

    def update_timeseries(self, base_path: str):
        """Get discharge data."""
        id = None if self.time_series is None else self.time_series.id
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
        with get_session() as session:
            if id:
                ts = crud.time_series.update(session, id=id, time_series=update_data)
            else:
                # add the time stamp of the video as a valid time stamp
                update_data["timestamp"] = self.timestamp
                # create a new record, happens when optical water level detection has been applied
                ts = crud.time_series.add(session, models.TimeSeries(**update_data))
            self.time_series = TimeSeriesResponse.model_validate(ts)


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


class VideoPatch(VideoResponse):
    """Patch schema for video.

    This makes all non-optional fields optional
    """

    timestamp: Optional[datetime] = Field(default=None)
    id: Optional[int] = Field(default=None)
    status: Optional[models.VideoStatus] = Field(default=None)
    sync_status: Optional[models.SyncStatus] = Field(default=None)
