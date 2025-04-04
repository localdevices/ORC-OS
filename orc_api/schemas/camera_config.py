"""Pydantic models for camera configurations."""

import warnings
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pyproj.crs import CRS

from orc_api.schemas.base import RemoteModel

# Alternatively, print traceback for warnings without halting execution
warnings.simplefilter("always", DeprecationWarning)


# Pydantic model for responses
class CameraConfigBase(BaseModel):
    """Base model for camera configuration."""

    name: Optional[str] = Field(default=None, description="Name of the device.")
    data: Optional[dict] = Field(default=None, description="Camera configuration")

    model_config = ConfigDict(from_attributes=True)

    @property
    def crs(self):
        """Return the coordinate reference system of the camera configuration as pyproj CRS object."""
        _crs = None
        if "crs" in self.data:
            _crs = CRS.from_user_input(self.data["crs"])
        return _crs


class CameraConfigResponse(CameraConfigBase, RemoteModel):
    """Response model for camera configuration."""

    id: int = Field(description="CameraConfig ID")

    def sync_remote(self, site: int):
        """Send the recipe to LiveORC API.

        Recipes belong to an institute, hence also the institute ID is required.
        """
        # endpoint = f"/api/site/{site}/cameraconfig/"
        # data = {
        #     "name": self.name,
        #     "camera_config": self.data,
        # }
        # TODO: this end point is not yet implemented, as it requires a restructuring on LiveORC
        pass


class CameraConfigCreate(CameraConfigBase):
    """Create model for camera configuration."""

    pass


class CameraConfigUpdate(BaseModel):
    """Update model for camera configuration."""

    name: Optional[str]
    data: Optional[dict]


class GCPs(BaseModel):
    """GCPs for camera configuration."""

    src: List[List[float]]  # src list of points in objective (e.g., [[col1, row1], [col2, row2]])
    dst: List[List[Optional[float]]]  # dst list of points in real-world [[x1, y1], [x2, y2], [x3, y3]]
    crs: Optional[str]  # Coordinate Reference System as a string
    height: float
    width: float


class FittedPoints(BaseModel):
    """Response model for fitted points for a camera configuration."""

    src_est: List[List[float]]
    dst_est: List[List[float]]
    camera_matrix: List[List[float]]
    dist_coeffs: List[List[float]]
    rvec: List[List[float]]
    tvec: List[List[float]]
    error: float
