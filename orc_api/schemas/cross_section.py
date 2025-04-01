"""Pydantic models for cross sections."""

from datetime import datetime

import geopandas as gpd
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pyorc.cli.cli_utils import read_shape_as_gdf

from orc_api import crud
from orc_api.database import get_session
from orc_api.schemas.base import RemoteModel


# Pydantic model for responses
class CrossSectionBase(BaseModel):
    """Base model for a cross-section."""

    timestamp: datetime = Field(default=datetime.now(), description="Moment at which cross section was measured.")
    name: str = Field(default=None, description="Free recognizable description of cross section.")
    features: dict = Field(description="GeoJSON formatted features of the cross section.")
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def validate_features(cls, v):
        """Validate the GeoJSON features following PyORC logic."""
        _ = read_shape_as_gdf(geojson=v.features)
        return v

    @property
    def gdf(self):
        """Return the cross-section as a GeoDataFrame."""
        crs = None if "crs" not in self.features else self.features["crs"]["properties"]["name"]
        return gpd.GeoDataFrame.from_features(self.features, crs=crs)

    @property
    def crs(self):
        """Return the coordinate reference system of the cross-section."""
        return self.gdf.crs


class CrossSectionResponse(CrossSectionBase, RemoteModel):
    """Response model for a cross-section."""

    id: int = Field(description="CrossSection ID")

    def sync_remote(self, site: int, **kwargs):
        """Send the cross-section to LiveORC API."""
        endpoint = f"/api/site/{site}/profile/"
        data = {
            "name": self.name,
            "timestamp": self.timestamp.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "data": self.features,
        }
        # sync remotely with the updated data, following the LiveORC end point naming
        response_data = super().sync_remote(endpoint=endpoint, data=data)
        if response_data is not None:
            # patch the record in the database, where necessary
            response_data["features"] = response_data.pop("data")
            # remove site from response
            # response_data.pop("site")
            # update schema instance
            update_cross_section = CrossSectionResponse.model_validate(response_data)
            crud.cross_section.update(
                get_session(), id=self.id, cross_section=update_cross_section.model_dump(exclude_unset=True)
            )
            return update_cross_section
