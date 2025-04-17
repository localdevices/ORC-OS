"""Pydantic models for daemon settings."""

import os
from datetime import datetime
from typing import Optional

from fastapi import UploadFile
from pydantic import BaseModel, ConfigDict, Field

from orc_api.database import get_session
from orc_api.routers.video import upload_video
from orc_api.utils import disk_management


# Pydantic model for responses
class SettingsBase(BaseModel):
    """Base schema for disk management."""

    parse_dates_from_file: Optional[bool] = Field(
        default=None,
        description="Flag determining if dates should be read from a datestring in the filename (True, default) or "
        "from the file metadata (False)",
    )
    video_file_fmt: Optional[str] = Field(
        default=None,
        description="Filename template (excluding path) defining the file name convention of video files. The template "
        "contains a datestring format in between {} signs, e.g. video_{%Y%m%dT%H%M%S}.mp4",
    )
    allowed_dt: Optional[float] = Field(
        default=None,
        description="Maximum difference in time allowed between a videofile timestamp and a water level timestamp. ",
    )
    shutdown_after_task: Optional[bool] = Field(
        default=None,
        description="Flag for enabling automated shutdown after a task is performed. Must ONLY be used if a power "
        "cycling scheme is implemented and is meant to save power only.",
    )
    reboot_after: Optional[float] = Field(
        default=None, description="Amount of seconds after which device reboots (0 means never reboot)"
    )
    video_config_id: Optional[int] = Field(default=None, description="Video Config ID used to process videos.")


class SettingsResponse(SettingsBase):
    """Response schema for disk management."""

    id: int = Field(description="Disk management ID")
    created_at: datetime = Field(description="Creation date")
    # ensure instances can be created from sqlalchemy model instances
    model_config = ConfigDict(from_attributes=True)

    async def check_new_videos(self, path_incoming, app, logger):
        """Check for new videos in incoming folder, add to database and queue if ready to run."""
        # check the incoming folder
        print("CHECKING")
        file_paths = disk_management.scan_folder(path_incoming, self.video_file_fmt.split(".")[-1])
        for file_path in file_paths:
            # each file is checked if it is not yet in the queue and not
            # being written into
            if os.path.isfile(file_path) and not disk_management.is_file_size_changing(file_path):
                # first move the file to a temporary location
                tmp_file = os.path.join(path_incoming, "tmp", os.path.split(file_path)[1])
                os.makedirs(os.path.split(tmp_file)[0], exist_ok=True)
                os.rename(file_path, tmp_file)
                try:
                    timestamp = disk_management.get_timestamp(
                        tmp_file,
                        parse_from_fn=self.parse_dates_from_file,
                        fn_fmt=self.video_file_fmt,
                    )
                except Exception as e:
                    message = f"Could not get a logical timestamp from file {file_path}. Reason: {e}"
                    logger.error(message)
                    raise ValueError(message)
                logger.info(
                    f"Found file: {file_path} with timestamp {timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')}, "
                    f"adding to database."
                )
                # Add a new record for the provided file, first only timestamp
                file = UploadFile(filename=os.path.split(tmp_file)[1], file=open(tmp_file, "rb"))
                with get_session() as session:
                    video_response = await upload_video(
                        file=file, timestamp=timestamp, video_config=self.video_config_id, db=session
                    )
                if video_response:
                    app.state.process_list.append(video_response)
                else:
                    # remove the tmp file
                    logger.error(f"Could not add video to database for file {file_path}.")
                # whatever happens, remove the file if not successful, prevent clogging
                os.remove(tmp_file)


class SettingsCreate(SettingsBase):
    """Create schema for disk management."""

    pass
