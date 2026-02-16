"""Video schema."""

import glob
import os
import subprocess
import time
from datetime import datetime
from typing import Optional

import numpy as np
import xarray as xr
from pydantic import BaseModel, ConfigDict, Field, computed_field
from pyorc.service import velocity_flow_subprocess
from sqlalchemy.orm import Session

from orc_api import crud, timeout_before_shutdown
from orc_api import db as models
from orc_api.database import get_session
from orc_api.db import Video
from orc_api.log import logger
from orc_api.schemas.base import RemoteModel
from orc_api.schemas.time_series import TimeSeriesResponse
from orc_api.schemas.video_config import VideoConfigBase, VideoConfigResponse, VideoConfigUpdate
from orc_api.utils.image import get_frame_count, get_height_width
from orc_api.utils.states import SyncRunStatus, VideoRunStatus, video_run_state


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
    sync_status: Optional[models.SyncStatus]
    remote_id: Optional[int] = Field(default=None)

    @classmethod
    def from_orm_model(
        cls, video: models.Video, video_config: Optional[VideoConfigResponse] = None
    ) -> "VideoListResponse":
        """Create a VideoListResponse directly from an ORM Video model."""
        # Build ws dict directly from ORM relationship
        time_series = TimeSeriesResponse.model_validate(video.time_series) if video.time_series else None
        video_config_data = None
        if video.video_config:
            video_config_data = {
                "id": video.video_config.id,
                "name": video.video_config.name,
                "sample_video_id": video.video_config.sample_video_id,
                "ready_to_run": video_config.ready_to_run if hasattr(video_config, "ready_to_run") else None,
            }

        # Calculate allowed_to_run directly
        allowed = cls._calculate_allowed_to_run(video, video_config, video.time_series)

        return cls(
            id=video.id,
            file=video.file,
            timestamp=video.timestamp,
            video_config=video_config_data,
            allowed_to_run=allowed,
            time_series=time_series,
            status=video.status,
            sync_status=video.sync_status,
            remote_id=video.remote_id,
        )

    @staticmethod
    def _calculate_allowed_to_run(
        video: "models.Video",
        video_config: Optional[VideoConfigResponse] = None,
        time_series: Optional[TimeSeriesResponse] = None,
    ) -> bool:
        """Calculate allowed_to_run without full Pydantic validation."""
        if video_config is None:
            return False
        if video_config.sample_video_id == video.id:
            if (
                video_config.camera_config.gcps is not None
                and hasattr(video_config.camera_config.gcps, "h_ref")
                and video_config.camera_config.gcps.h_ref is not None
            ):
                return True
        if time_series:
            if time_series.h:
                return True
        if video_config.cross_section_wl is None:
            return False
        return True


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

    def patch_post(self, db):
        """Patch or post instance dependent on whether an ID is already set or not."""
        video_dict = self.model_dump(
            exclude_none=True,
            include={"timestamp", "file", "image", "thumbnail", "status", "time_series_id", "video_config_id"},
        )
        if self.id is None:
            video_db = Video(**video_dict)
            video_db = crud.video.add(db=db, video=video_db)
        else:
            video_db = crud.video.update(db=db, id=self.id, video=video_dict)
        return VideoResponse.model_validate(video_db)

    def dims(self, base_path: str) -> tuple[int, int]:
        """Get dimensions of video file."""
        if (
            self.video_config
            and self.video_config.camera_config
            and self.video_config.camera_config.rotation in [90, 270]
        ):
            # flip the dims
            return tuple(reversed(get_height_width(self.get_video_file(base_path=base_path))))
        return get_height_width(self.get_video_file(base_path=base_path))

    def frame_count(self, base_path: str) -> int:
        """Get number of frames in video file."""
        return get_frame_count(self.get_video_file(base_path=base_path))

    def ready_to_sync(self, site=None):
        """Check if video can be synced or not.

        This requires a site ID to be provided. It will be checked if the site id is available in the database.
        If the site is not available, False is returned. If the site is available, True is returned.
        """

    @computed_field
    @property
    def allowed_to_run(self) -> tuple[bool, str]:
        """Check if prerequisites are met for running video."""
        # if there is no video config, return False immediately
        if self.video_config is None:
            return False, "No video config available."
        # second check if video_config sample video is the same as current video, then retrieve water level
        if self.video_config.sample_video_id == self.id:
            if (
                self.video_config.camera_config.gcps is not None
                and hasattr(self.video_config.camera_config.gcps, "h_ref")
                and self.video_config.camera_config.gcps.h_ref is not None
            ):
                # if self.video_config.camera_config.gcps.h_ref is not None:
                return True, "Ready"
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

    def run(self, base_path: str, prefix: str = "", shutdown_after_task: bool = False):
        """Run video."""
        # update state first
        with get_session() as session:
            try:
                # set up a temporary additional log file handler
                rec = crud.video.get(session, id=self.id)
                if not rec:
                    raise ValueError(f"Video with id {self.id} does not exist in database.")
                rec.status = models.VideoStatus.TASK
                session.commit()
                session.refresh(rec)
                # now also show the state PROCESSING in web socket
                filename = os.path.split(self.file)[1] if self.file else None
                video_run_state.update(
                    video_id=self.id,
                    video_file=filename,
                    status=VideoRunStatus.PROCESSING,
                    sync_status=SyncRunStatus.IDLE,
                    message=f"Starting processing of video: {filename}",
                )
                if self.time_series:
                    # for older versions (python 3.9) check and validate
                    self.time_series = TimeSeriesResponse.model_validate(self.time_series)
                allowed_to_run, msg = self.allowed_to_run
                if not allowed_to_run:
                    raise Exception(msg)

                # check for h_a
                h_a = None if self.time_series is None else self.time_series.h
                logger.debug(f"Checked for water level in time series, found {h_a:.3f} m.")

                # overrule with set level if the video configuration is made with the current video
                if self.video_config.sample_video_id == self.id:
                    logger.debug("Overruling water level because video is a sample video for the video configuration.")
                    h_a = self.video_config.camera_config.gcps.h_ref

                # assemble all information
                logger.info(f"Water level set to {h_a:.3f} m.")
                # check if h_a is above lowest point in cross section
                validate_h_a_cross = self.video_config.cross_section_wl_rt.validate_h_a(h_a=h_a)
                if not validate_h_a_cross:
                    raise Exception(
                        f"Provided water level {h_a:.3f} m is not above the lowest point in the cross section. "
                        f"Please provide a higher water level, or adjust the cross section."
                    )
                output = os.path.join(self.get_path(base_path=base_path), "output")
                cameraconfig = self.video_config.camera_config.data.model_dump()
                # get the rotated/translated cross-section
                cross = self.video_config.cross_section_rt.features
                # if h_a is not available and a cross section is available, make cross section file for water level
                if h_a is None and self.video_config.cross_section_wl:
                    cross_wl = self.video_config.cross_section_wl_rt.features
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
                    if h_a is not None:
                        h_a_str = f"{np.round(h_a, 3)} m."
                    else:
                        h_a_str = "None"
                    video_run_state.update(
                        message=f"Processing with h: {h_a_str} to "
                        f"{self.get_output_path(base_path=base_path).split(base_path)[-1]}"
                    )
                # run the video with pyorc with an additional logger handler
                logger.info(
                    "Starting video processing with pyorc. You can check logs per video record after running in "
                    "the video view."
                )
                res = velocity_flow_subprocess(
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
                if res.returncode != 0:
                    raise Exception(
                        f"Error running video, pyorc returned non-zero exit code: {res.returncode} and error output "
                        f"{res.stderr}"
                        "Please check the log belonging to video"
                    )
                self.image = rel_img_fn
                # update time series (before video, in case time series with optical water level is added in the process
                logger.info("Updating time series belonging to video.")
                self.update_timeseries(session=session, base_path=base_path)
                # update status
                self.status = models.VideoStatus.DONE
                video_run_state.update(status=VideoRunStatus.SUCCESS, message="Processing successful.")
            except Exception as e:
                # ensure status is ERROR, but continue afterwards
                self.status = models.VideoStatus.ERROR
                # also show this state in the web socket
                video_run_state.update(status=VideoRunStatus.ERROR, message=f"Error running video: {filename}: {e}")
                logger.error(f"Error running video, response: {e}, VideoStatus set to ERROR.")
            # finally:
            #     # the last handler should be our file handler.
            #     remove_file_handler(logger, name_contains="pyorc.log")

            update_data = self.serialize_for_db()
            if self.time_series:
                update_data["time_series_id"] = self.time_series.id
            # with get_session() as session:
            crud.video.update(session, id=self.id, video=update_data)
            # check if remote syncing is possible.
            # This requires a fully configured callback_url including a site to report on
            callback_url = crud.callback_url.get(session)
            settings = crud.settings.get(session)
            # only in daemon mode attempt to sync automatically
            if callback_url and callback_url.remote_site_id:
                # make a timeout, maximized on 150 seconds
                timeout = min(callback_url.retry_timeout, 150) if callback_url.retry_timeout else 150
                logger.debug("Attempting syncing to remote site ")
                self.sync_remote(
                    session=session,
                    base_path=base_path,
                    site=callback_url.remote_site_id,
                    sync_file=settings.sync_file,
                    sync_image=settings.sync_image,
                    timeout=timeout,
                )

            # shutdown if this is set
            if shutdown_after_task:
                logger.info(f"Shutdown triggered by daemon. Shutting down in {timeout_before_shutdown} seconds.")
                time.sleep(timeout_before_shutdown)
                logger.info("Shutting down after daemon task...Bye bye :-)")
                subprocess.call("sudo shutdown -h now", shell=True)
            # only do a raise after the shutdown has been done, to avoid not shutting down at all.
            if self.status == models.VideoStatus.ERROR:
                video_run_state.update(status=VideoRunStatus.ERROR)
                raise Exception("Error running video, VideoStatus set to ERROR.")

            return

    def serialize_for_db(self):
        """Only maintain fields that can and must be stored in the database."""
        return self.model_dump(
            exclude_unset=True,
            exclude={"id", "created_at", "video_config", "time_series", "allowed_to_run"},
        )

    def sync_remote(
        self,
        session: Session,
        base_path: str,
        site: int,
        sync_file: bool = True,
        sync_image: bool = True,
        timeout: float = 120,
    ):
        """Send the video to LiveORC API."""
        try:
            # first update Sync Status to QUEUE so that syncing may be re-attempted upon reboot
            _ = crud.video.update(session, id=self.id, video={"sync_status": models.SyncStatus.QUEUE})
            filename = os.path.split(self.file)[1]
            video_run_state.update(
                video_id=self.id,
                video_file=filename,
                sync_status=SyncRunStatus.SYNCING,
                status=self.status,
                message=f"Syncing to remote site {site}",
            )
            # first check if the video config and time series are synced
            if self.video_config is not None:
                if self.video_config.sync_status != models.SyncStatus.SYNCED:
                    # first sync/update recipe
                    logger.debug(f"Syncing video configuration {self.video_config.id} to remote site {site}.")
                    self.video_config = self.video_config.sync_remote(session=session, site=site)
                    self.video_config_id = self.video_config.id
            if self.time_series is not None:
                if self.time_series.sync_status != models.SyncStatus.SYNCED:
                    logger.debug(
                        f"Syncing time series {self.time_series.id} - {self.time_series.timestamp} "
                        f"to remote site {site}."
                    )
                    self.time_series = self.time_series.sync_remote(session=session, site=site)
                    self.time_series_id = self.time_series.id

            # only sync if an image and/or video file should be submitted. Otherwise only time series is sufficient.
            sync_file_required = self.file and os.path.exists(self.get_video_file(base_path=base_path)) and sync_file
            sync_image_required = self.image and os.path.exists(self.get_image_file(base_path=base_path)) and sync_image
            if sync_file_required or sync_image_required:
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
                if sync_file_required:
                    files["file"] = (self.file, open(self.get_video_file(base_path=base_path), "rb"))
                if sync_image_required:
                    files["image"] = (self.image, open(self.get_image_file(base_path=base_path), "rb"))
                # we take a little bit longer to try and sync the video (15sec time out instead of 5sec)
                logger.debug(f"Syncing video {self.id} - {self.file} to remote site {site}.")
                response_data = super().sync_remote(
                    session=session, endpoint=endpoint, data=data, files=files, timeout=timeout
                )
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
                        session,
                        id=self.id,
                        video=update_video.serialize_for_db(),  # model_dump(exclude_unset=True, exclude_none=True)
                    )
                    logger.info(f"Syncing to remote site {site} successful.")
                    video_run_state.update(
                        sync_status=SyncRunStatus.SUCCESS,
                        message=f"Syncing to remote site {site} successful.",
                    )
                    return VideoResponse.model_validate(r)
                return None
            # if no syncing of video is needed, only update the sync status back to LOCAL
            logger.debug(
                f"Skipping syncing of video {self.id} - {self.file}. No image or video file requested to sync."
            )
            video_run_state.update(
                sync_status=SyncRunStatus.SUCCESS,
                message=f"Syncing to remote site {site} without video sucessful.",
            )
            _ = crud.video.update(session, id=self.id, video={"sync_status": models.SyncStatus.LOCAL})
        except Exception as e_sync:
            logger.error(f"Error syncing video to remote site: {e_sync}. Full traceback below.")
            video_run_state.update(
                sync_status=SyncRunStatus.FAILED,
                message=f"Error syncing to remote site {site}: {e_sync}",
            )
            # also update record
            _ = crud.video.update(session, id=self.id, video={"sync_status": models.SyncStatus.FAILED})
            logger.exception("Traceback: ")

    def sync_remote_wrapper(
        self, base_path: str, site: int, sync_file: bool = True, sync_image: bool = True, timeout: float = 150
    ):
        """Wrap remote sync from queue without a required database input.

        This wrapper prevents that very long opened database sessions are created when queueing sync jobs.
        """
        with get_session() as session:
            return self.sync_remote(
                session=session,
                base_path=base_path,
                site=site,
                sync_file=sync_file,
                sync_image=sync_image,
                timeout=timeout,
            )

    def get_path(self, base_path: str):
        """Get media path to video."""
        return os.path.split(self.get_video_file(base_path))[0]

    def get_output_path(self, base_path: str):
        """Get output path to video."""
        return os.path.join(self.get_path(base_path=base_path), "output")

    def get_log_file(self, base_path: str):
        """Get log file name."""
        fn = os.path.join(self.get_path(base_path=base_path), "pyorc.log")
        return fn

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

    def update_timeseries(self, session: Session, base_path: str):
        """Get discharge data."""
        id = None if self.time_series is None else self.time_series.id
        fn = self.get_discharge_file(base_path=base_path)
        if fn is None:
            return

        ds = xr.open_dataset(fn)
        h = float(ds.h_a)
        Q = np.abs(ds.river_flow.values)
        if "v_eff" in ds:
            if len(ds["quantile"]) == 5:
                # only report middle quantile
                q = 2
            else:
                q = 0
            v_av = np.abs(ds.isel(quantile=q).transect.get_v_surf().values)
            v_bulk = np.abs(ds.isel(quantile=q).transect.get_v_bulk().values)
        else:
            v_av = np.nan
            v_bulk = np.nan
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
            "v_av": v_av,
            "v_bulk": v_bulk,
            "wetted_surface": ds.transect.wetted_surface,
            "wetted_perimeter": ds.transect.wetted_perimeter,
            "fraction_velocimetry": perc_measured[2] if np.isfinite(perc_measured[2]) else None,
            "sync_status": models.SyncStatus.UPDATED,  # set sync status to updated, so that syncing can be reperformed
        }
        # with get_session() as session:
        if id:
            ts = crud.time_series.update(session, id=id, time_series=update_data)
        else:
            # add the time stamp of the video as a valid time stamp
            update_data["timestamp"] = self.timestamp
            # create a new record, happens when optical water level detection has been applied
            ts = crud.time_series.add(session, models.TimeSeries(**update_data))
        self.time_series = TimeSeriesResponse.model_validate(ts)


class VideoUpdate(VideoResponse):
    """Schema for updating video configuration."""

    video_config: Optional[VideoConfigUpdate] = Field(description="Video configuration update.", default=None)


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


class SyncVideosRequest(BaseModel):
    """Request body schema for syncing videos."""

    start: Optional[datetime] = None
    stop: Optional[datetime] = None
    sync_file: Optional[bool] = True
    sync_image: Optional[bool] = True
    site: Optional[int] = None


class VideoPatch(VideoResponse):
    """Patch schema for video.

    This makes all non-optional fields optional
    """

    timestamp: Optional[datetime] = Field(default=None)
    id: Optional[int] = Field(default=None)
    status: Optional[models.VideoStatus] = Field(default=None)
    sync_status: Optional[models.SyncStatus] = Field(default=None)
