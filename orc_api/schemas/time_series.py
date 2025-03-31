"""Pydantic models for time series."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from orc_api.schemas.base import RemoteModel


# Pydantic model for responses
class TimeSeriesBase(BaseModel):
    """Base model for a time series."""

    timestamp: datetime = Field(description="Timestamp of the video.")
    h: Optional[float] = Field(
        default=None, description="Value of water level in meter, referenced against local datum [m]"
    )
    q_05: Optional[float] = Field(
        default=None, description="Streamflow with probability of non-exceedance of 5% [m3/s]"
    )
    q_25: Optional[float] = Field(
        default=None, description="Streamflow with probability of non-exceedance of 25% [m3/s]"
    )
    q_50: Optional[float] = Field(
        default=None, description="Streamflow with probability of non-exceedance of 50% [m3/s]"
    )
    q_75: Optional[float] = Field(
        default=None, description="Streamflow with probability of non-exceedance of 75% [m3/s]"
    )
    q_95: Optional[float] = Field(
        default=None, description="Streamflow with probability of non-exceedance of 95% [m3/s]"
    )
    wetted_surface: Optional[float] = Field(default=None, description="Wetted surface area with given water level [m2]")
    wetted_perimeter: Optional[float] = Field(default=None, description="Wetted perimeter with given water level [m]")
    fraction_velocimetry: Optional[float] = Field(
        default=None, description="Fraction of discharge resolved using velocimetry [-]"
    )
    model_config = {"from_attributes": True}


class TimeSeriesCreate(TimeSeriesBase):
    """Create model for a time series."""

    pass


class TimeSeriesResponse(TimeSeriesBase, RemoteModel):
    """Response model for a time series."""

    id: int = Field(description="TimeSeries ID")
