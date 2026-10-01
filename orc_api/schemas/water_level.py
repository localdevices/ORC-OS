"""Pydantic models for water level settings."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from orc_api.db import ScriptType, WaterLevelUnit


# Pydantic model for responses
class WaterLevelBase(BaseModel):
    """Base schema for water level settings."""

    frequency: Optional[float] = Field(
        default=None, description="Frequency [s] for checking for new water levels using the script."
    )
    script_type: Optional[ScriptType] = Field(
        default=None, description="Script type provided for checking water levels. Can be 'python' or 'bash'."
    )
    script: Optional[str] = Field(
        default=None,
        description="Content of the script to be executed to retrieve water levels. Script must print a water level "
        "value to screen (stdout) in the form '%Y-%m-%dT%H:%M:%SZ, <value>'",
    )
    optical: Optional[bool] = Field(default=False, description="Allow optical water level detection (false/true)")
    enabled: Optional[bool] = Field(
        default=False, description="Whether to enable water level retrieval using the script."
    )
    water_level_unit: Optional[WaterLevelUnit] = Field(
        default=WaterLevelUnit.METRIC,
        description="Unit in which water levels are retrieved. Can be 'METRIC' (meters) or 'IMPERIAL' (feet).",
    )


class WaterLevelResponse(WaterLevelBase):
    """Response schema for water level settings."""

    id: int = Field(description="Water level settings ID")
    created_at: datetime = Field(description="Creation date")
    model_config = ConfigDict(from_attributes=True)


class WaterLevelCreate(WaterLevelBase):
    """Create schema for water level settings."""

    pass


class WaterLevelUpdate(BaseModel):
    """Update schema for water level settings."""

    pass
