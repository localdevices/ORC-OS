from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


# Pydantic model for responses
class SettingsBase(BaseModel):
    parse_dates_from_file: Optional[bool] = Field(
        default=None,
        description="Flag determining if dates should be read from a datestring in the filename (True, default) or "
                "from the file metadata (False)"
    )
    video_file_fmt: Optional[str] = Field(
        default=None,
        description="Filename template (excluding path) defining the file name convention of video files. The template "
                "contains a datestring format in between {} signs, e.g. video_{%Y%m%dT%H%M%S}.mp4"
    )
    allowed_dt: Optional[float] = Field(
        default=None,
        description="Maximum difference in time allowed between a videofile timestamp and a water level timestamp. "
    )
    shutdown_after_task: Optional[bool] = Field(
        default=None,
        description="Flag for enabling automated shutdown after a task is performed. Must ONLY be used if a power "
                "cycling scheme is implemented and is meant to save power only."
    )
    reboot_after: Optional[bool] = Field(
        default=None,
        description="Amount of seconds after which device reboots (0 means never reboot)"
    )

class SettingsResponse(SettingsBase):
    id: int = Field(description="Disk management ID")
    created_at: datetime = Field(description="Creation date")

class SettingsCreate(SettingsBase):
    pass