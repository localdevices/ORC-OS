"""Pydantic models for time series."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from orc_api import crud
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
    q_raw: Optional[float] = Field(default=None, description="Streamflow measured optically [m3/s]")
    v_av: Optional[float] = Field(default=None, description="Average surface velocity [m/s]")
    v_bulk: Optional[float] = Field(default=None, description="Bulk velocity [m/s]")
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

    def sync_remote(self, session: Session, site: int):
        """Send the time series record to LiveORC API.

        Recipes belong to an institute, hence also the institute ID is required.
        """
        endpoint = f"/api/site/{site}/timeseries/"
        data = self.model_dump(
            exclude_unset=True, exclude_none=True, exclude=["id", "remote_id", "created_at", "sync_status"], mode="json"
        )

        # sync remotely with the updated data, following the LiveORC end point naming
        response_data = super().sync_remote(session=session, endpoint=endpoint, json=data)
        if response_data is not None:
            # patch the record in the database, where necessary
            # update schema instance
            update_time_series = TimeSeriesResponse.model_validate(response_data)
            r = crud.time_series.update(
                session, id=self.id, time_series=update_time_series.model_dump(exclude_unset=True)
            )
            return TimeSeriesResponse.model_validate(r)


class TimeSeriesPatch(TimeSeriesResponse):
    """Patch model for a time series.

    Make timestamp also optional
    """

    id: Optional[int] = Field(description="TimeSeries ID", default=None)
    timestamp: Optional[datetime] = Field(default=None)
