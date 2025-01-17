from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Literal

from nodeorc.db import ScriptType

# Pydantic model for responses
class WaterLevelBase(BaseModel):
    datetime_fmt: Optional[str] = Field(default=None, description="Datestring format used in files containing water level data.")
    file_template: Optional[str] = Field(default=None, description="File name template for water level data files. May contain {%Y%m%d} to accomodate several files for different dates.")
    frequency: Optional[float] = Field(default=None, description="Frequency [s] for checking for new water levels using the script.")
    script_type: Optional[ScriptType] = Field(default=None, description="Script type provided for checking water levels. Can be 'python' or 'bash'.")
    script: Optional[str] = Field(default=None, description="Content of the script to be executed to retrieve water levels. Script must print a water level value to screen (stdout) in the form '%Y-%m-%dT%H:%M:%SZ, <value>'")


class WaterLevelResponse(WaterLevelBase):
    id: int = Field(description="Water level settings ID")
    created_at: datetime = Field(description="Creation date")

    class Config:
        from_attributes = True


class WaterLevelCreate(WaterLevelBase):
    pass


class WaterLevelUpdate(BaseModel):
    pass
