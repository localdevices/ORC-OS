"""Pydantic models for cross sections."""

from datetime import datetime
from typing import List, Optional

import geopandas as gpd
import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pyorc import CrossSection as pyorcCrossSection
from pyorc.cli.cli_utils import read_shape_as_gdf
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db import CrossSection
from orc_api.schemas.base import RemoteModel
from orc_api.schemas.camera_config import CameraConfigResponse


def pose_info_complete(camera_config: CameraConfigResponse):
    """Check if all pose information is available."""
    return (
        camera_config.data.rvec is not None
        and camera_config.data.tvec is not None
        and camera_config.data.camera_matrix is not None
        and camera_config.data.dist_coeffs is not None
    )


# Pydantic model for responses
class CrossSectionBase(BaseModel):
    """Base model for a cross-section."""

    timestamp: Optional[datetime] = Field(
        default=datetime.now(), description="Moment at which cross section was measured."
    )
    name: Optional[str] = Field(default=None, description="Free recognizable description of cross section.")
    features: dict = Field(description="GeoJSON formatted features of the cross section.")
    model_config = ConfigDict(from_attributes=True)

    x: List[float] = Field(default=[], description="x-coordinates of the cross section points.")
    y: List[float] = Field(default=[], description="y-coordinates of the cross section points.")
    z: List[float] = Field(default=[], description="z-coordinates of the cross section points.")
    s: List[float] = Field(default=[], description="s-coordinates of the cross section points.")

    @model_validator(mode="after")
    def validate_features(cls, v):
        """Validate the GeoJSON features following PyORC logic."""
        gdf, crs = read_shape_as_gdf(geojson=v.features)

        v.x = gdf.geometry.x.values.tolist()
        v.y = gdf.geometry.y.values.tolist()
        v.z = gdf.geometry.z.values.tolist()
        v.s = np.cumsum(
            ((gdf.geometry.x.diff().fillna(0)) ** 2 + (gdf.geometry.y.diff().fillna(0) ** 2)) ** 0.5
        ).tolist()
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

    def patch_post(self, db):
        """Patch or post the cross section depending on whether an ID is set."""
        # first validate as Update
        cs_dict = self.model_dump(
            exclude_none=True, include={"name", "timestamp", "features", "remote_id", "sync_status"}
        )
        if self.id is None:
            cs_db = CrossSection(**cs_dict)
            cs_db = crud.cross_section.add(db=db, cross_section=cs_db)
        else:
            cs_db = crud.cross_section.update(db=db, id=self.id, cross_section=cs_dict)
        return CrossSectionResponse.model_validate(cs_db)


class CrossSectionResponse(CrossSectionBase, RemoteModel):
    """Response model for a cross-section."""

    id: Optional[int] = Field(default=None, description="CrossSection ID")
    # in response, name is required
    name: str = Field(description="Free recognizable description of cross section.")

    def sync_remote(self, session: Session, site: int, **kwargs):
        """Send the cross-section to LiveORC API."""
        endpoint = f"/api/site/{site}/profile/"
        data = {
            "name": self.name,
            "timestamp": self.timestamp.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "data": self.features,
        }
        # sync remotely with the updated data, following the LiveORC end point naming
        response_data = super().sync_remote(session=session, endpoint=endpoint, json=data)
        if response_data is not None:
            # patch the record in the database, where necessary
            response_data["features"] = response_data.pop("data")
            # update schema instance
            update_cross_section = CrossSectionResponse.model_validate(response_data)
            r = crud.cross_section.update(
                session,
                id=self.id,
                cross_section=update_cross_section.model_dump(exclude_unset=True, exclude=["x", "y", "z", "s"]),
            )
            return CrossSectionResponse.model_validate(r)
        return None


class CrossSectionResponseCameraConfig(CrossSectionResponse):
    """Response model for a cross-section with camera configuration."""

    camera_config: Optional[CameraConfigResponse] = Field(default=None)
    bottom_surface: List[List[float]] = Field(default=[])
    wetted_surface: List[List[float]] = Field(default=[])
    water_lines: List[List[List[float]]] = Field(default=[])
    distance_camera: Optional[float] = Field(default=None)
    within_image: Optional[bool] = Field(default=None)
    bbox_wet: List[List[List[float]]] = Field(default=[])

    @model_validator(mode="after")
    def create_perspective_fields(cls, v):
        """Add fields that allow plotting in camera perspective."""
        # create fields for plotting
        v.within_image = False  # default, if cm config is available will be updated
        if v.camera_config is not None:
            if pose_info_complete(v.camera_config):
                # create a cross section object with the camera configuration
                h = 0.0
                # overwrite when h_ref is defined
                if v.camera_config.obj.gcps is not None:
                    if v.camera_config.obj.gcps["h_ref"] is not None:
                        h = v.camera_config.obj.gcps["h_ref"]

                z = v.camera_config.obj.h_to_z(h)
                if z <= np.array(v.obj.z).max() and z > np.array(v.obj.z).min():
                    v.water_lines = v.get_csl_line(h=h, length=2.0, offset=0.0, camera=True)
                    v.bbox_wet = v.get_bbox_dry_wet(h=h)
                else:
                    v.water_lines = []
                    v.bbox_wet = []
                v.wetted_surface = v.get_wetted_surface(h=h, camera=True)
                # also provide the info to determine if the cross section is within the image and not too far off
                v.within_image = v.obj.within_image
                if v.within_image:
                    # add the fields for plotting
                    v.bottom_surface = list(
                        map(
                            list,
                            v.obj.get_bottom_surface(
                                length=0.01, offset=0.0, camera=True, swap_y_coords=False
                            ).exterior.coords,
                        )
                    )
                v.distance_camera = v.obj.distance_camera
                v.x = v.obj.x.tolist()
                v.y = v.obj.y.tolist()
                v.z = v.obj.z.tolist()
                v.s = np.append(
                    np.array(0.0), np.cumsum((np.diff(v.obj.x) ** 2 + np.diff(v.obj.y) ** 2) ** 0.5)
                ).tolist()
        return v

    @property
    def obj(self):
        """Return the cross section as a pyorc CrossSection object."""
        if self.camera_config is None:
            return None
        return pyorcCrossSection(camera_config=self.camera_config.obj, cross_section=self.gdf)

    def get_wetted_surface(self, h: float, camera: bool = True) -> Optional[List[List[float]]]:
        """Return the wetted surface of the cross section in serializable coordinates."""
        if self.obj is None:
            return []
        pols = self.obj.get_wetted_surface(camera=camera, swap_y_coords=False, h=h)
        # find the largest one
        area = 0.0
        pol = None
        for p in pols.geoms:
            if p.area > area:
                pol = p
                area = p.area
        if pol is None:
            return []
        return list(map(list, pol.exterior.coords))

    def get_csl_line(self, h: float, camera: bool = True, length=1.0, offset=0.0) -> Optional[List[List[List[float]]]]:
        """Return the cross section line of the cross section in serializable coordinates."""
        if self.obj is None:
            return []
        # get list of linestrings
        lines = self.obj.get_csl_line(h=h, camera=camera, length=length, offset=offset)
        # convert into list of list of lists (with coordinates)
        return [list(map(list, line.coords)) for line in lines]

    def get_bbox_dry_wet(self, h: float, camera: bool = True, dry: bool = False):
        """Return the bounding box of the cross section in serializable coordinates."""
        if self.obj is None:
            return []
        if not hasattr(self.obj.camera_config, "bbox"):
            # no bbox set yet, return empty list
            return []
        if not self.obj.within_image:
            return []
        # get list of polygons
        pols = self.obj.get_bbox_dry_wet(h=h, camera=camera, dry=dry)
        return [list(map(list, pol.exterior.coords)) for pol in pols.geoms]


class CrossSectionUpdate(CrossSectionBase):
    """Update model with several input fields from user."""

    # TODO: create interactive options for updating
    pass


class CrossSectionCreate(CrossSectionBase):
    """Create model for a cross-section."""

    # id: Optional[int] = Field(default=None, description="CrossSection ID")
    pass
