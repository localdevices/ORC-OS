"""Pydantic models for camera configurations."""

import warnings
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pyproj.crs import CRS

from orc_api.db.base import SyncStatus

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


class CameraConfigResponse(CameraConfigBase):
    """Response model for camera configuration."""

    id: int = Field(description="Camera configuration ID")
    created_at: datetime = Field(description="Creation date")
    remote_id: Optional[int] = Field(default=None, description="ID of the camera configuration on the remote server")
    sync_status: SyncStatus = Field(
        default=SyncStatus.LOCAL, description="Status of the cmaera configuration on the remote server"
    )


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
