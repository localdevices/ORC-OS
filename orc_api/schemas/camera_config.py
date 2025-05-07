"""Pydantic models for camera configurations."""

import warnings
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pyproj.crs import CRS

from orc_api.schemas.base import RemoteModel

# Alternatively, print traceback for warnings without halting execution
warnings.simplefilter("always", DeprecationWarning)


class GCPData(BaseModel):
    """GCP data model."""

    src: Optional[List[List[float]]] = Field(default=None, description="GCP source points.")
    dst: Optional[List[List[float]]] = Field(default=None, description="GCP destination points.")
    crs: Optional[str] = Field(default=None, description="Coordinate Reference System of the GCPs.")
    h_ref: Optional[float] = Field(default=None, description="Reference height of water level in local datum.")
    z_0: Optional[float] = Field(default=None, description="Reference height of water level in GCP datum.")


class CameraConfigData(BaseModel):
    """Camera configuration data model."""

    height: float = Field(description="Height of the image in pixels.")
    width: float = Field(description="Width of the image in pixels.")
    crs: Optional[str] = Field(default=None, description="Coordinate Reference System of the area of interest.")
    gcps: GCPData = Field(default_factory=GCPData)
    resolution: Optional[float] = Field(default=None, description="Resolution of the reprojection.")
    window_size: Optional[int] = Field(
        default=None, description="Window size for the PIV interrogation or STIV spacing."
    )
    is_nadir: bool = Field(default=False, description="Whether the camera is nadir or not.")
    camera_matrix: Optional[List[List[float]]] = Field(default=None, description="Camera matrix of the camera.")
    dist_coeffs: Optional[List[List[float]]] = Field(default=None, description="Distortion coefficients of the camera.")
    bbox: Optional[str] = Field(default=None, description="Bounding box of the camera as shape.")


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

    id: Optional[int] = Field(default=None, description="CameraConfig ID")

    @model_validator(mode="after")
    def populate_fields_from_data(cls, instance):
        """Populate the fields from the camera configuration data where needed, currently only placeholder."""
        if instance.data is None:
            # load a fresh empty camera config
            _ = CameraConfigData()
        else:
            # load data from existing pyorc camera config dict
            _ = CameraConfigData(**instance.data)
        return instance

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
