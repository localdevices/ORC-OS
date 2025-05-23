"""Pydantic models for camera configurations."""

import warnings
from typing import List, Optional

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pyorc import cv
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
    resolution: float = Field(default=0.02, description="Resolution of the reprojection.")
    window_size: int = Field(default=64, description="Window size for the PIV interrogation or STIV spacing.")
    is_nadir: bool = Field(default=False, description="Whether the camera is nadir or not.")
    camera_matrix: Optional[List[List[float]]] = Field(default=None, description="Camera matrix of the camera.")
    dist_coeffs: Optional[List[List[float]]] = Field(default=None, description="Distortion coefficients of the camera.")
    bbox: Optional[str] = Field(default=None, description="Bounding box of the camera as shape.")
    rvec: Optional[List[float]] = Field(default=None, description="rotation vector of camera.")
    tvec: Optional[List[float]] = Field(default=None, description="translation vector of camera.")


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


class CameraConfigRemote(CameraConfigBase, RemoteModel):
    """Model for camera configuration with remote fields included."""

    pass


class CameraConfigResponse(CameraConfigRemote):
    """Response model for camera configuration."""

    id: Optional[int] = Field(default=None, description="CameraConfig ID")
    data: CameraConfigData = Field(default=CameraConfigData, description="Data fields for camera config object.")
    camera_position: Optional[List[float]] = Field(
        default=None, description="Camera position in real-world coordinates."
    )
    camera_rotation: Optional[List[float]] = Field(
        default=None, description="Camera rotation in real-world coordinates."
    )
    f: Optional[float] = Field(default=None, description="Focal length in pixels.")
    k1: Optional[float] = Field(default=None, description="Radial distortion coefficient 1 [-]")
    k2: Optional[float] = Field(default=None, description="Radial distortion coefficient 2 [-]")
    # gcps_per_point: Optional[List[dict]] = Field(
    #     default=None,
    #     description="GCPs organized per point, containing all information for easy use in front end."
    # )

    @model_validator(mode="after")
    def populate_fields_from_data(cls, instance):
        """Populate the fields from the camera configuration data where needed, currently only placeholder."""
        if instance.data is not None:
            # load and validate data from existing pyorc camera config dict
            if instance.data.rvec is not None and instance.data.tvec is not None:
                camera_position, camera_rotation = cv.pose_world_to_camera(
                    np.array(instance.data.rvec), np.array(instance.data.tvec)
                )
                instance.camera_position, instance.camera_rotation = (
                    camera_position.tolist(),
                    camera_rotation.tolist(),
                )
            if instance.data.camera_matrix is not None:
                instance.f = instance.data.camera_matrix[0][0]
            if instance.data.dist_coeffs is not None:
                instance.k1 = instance.data.dist_coeffs[0][0]
                instance.k2 = instance.data.dist_coeffs[1][0]
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

    id: Optional[int] = Field(default=None)
    name: Optional[str] = Field(default=None)
    data: Optional[dict] = Field(default=None)


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
