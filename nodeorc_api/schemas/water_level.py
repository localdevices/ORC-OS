from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Literal

from nodeorc.db import ScriptType

# Pydantic model for responses
class WaterLevelBase(BaseModel):
    datetime_fmt: str = Field(description="Datestring format used in files containing water level data.")
    file_template: str = Field(description="File name template for water level data files. May contain {%Y%m%d} to accomodate several files for different dates.")
    frequency: float = Field(description="Frequency [s] for checking for new water levels using the script.")
    script_type: ScriptType = Field(description="Script type provided for checking water levels. Can be 'python' or 'bash'.")
    script: str = Field(description="Content of the script to be executed to retrieve water levels. Script must print a water level value to screen (stdout) in the form '%Y-%m-%dT%H:%M:%SZ, <value>'")


class WaterLevelResponse(WaterLevelBase):
    id: int = Field(description="Water level settings ID")
    created_at: datetime = Field(description="Creation date")

    class Config:
        from_attributes = True


class WaterLevelCreate(WaterLevelBase):
    pass


class WaterLevelUpdate(BaseModel):
    pass
