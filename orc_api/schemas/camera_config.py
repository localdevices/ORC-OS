"""Pydantic models for camera configurations."""

import warnings
from typing import List, Optional, Union

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pyorc import CameraConfig as pyorcCameraConfig
from pyorc import cv
from pyorc.cv import get_cam_mtx
from pyproj.crs import CRS

from orc_api.schemas.base import RemoteModel
from orc_api.schemas.control_points import ControlPoint, ControlPointSet

# Alternatively, print traceback for warnings without halting execution
warnings.simplefilter("always", DeprecationWarning)


class GCPData(BaseModel):
    """GCP data model."""

    src: Optional[List[List[float]]] = Field(default=None, description="GCP source points.")
    dst: Optional[List[List[float]]] = Field(default=None, description="GCP destination points.")
    crs: Optional[Union[str, int]] = Field(default=None, description="Coordinate Reference System of the GCPs.")
    h_ref: Optional[float] = Field(default=None, description="Reference height of water level in local datum.")
    z_0: Optional[float] = Field(default=None, description="Reference height of water level in GCP datum.")


class CameraConfigData(BaseModel):
    """Camera configuration data model."""

    height: int = Field(description="Height of the image in pixels.")
    width: int = Field(description="Width of the image in pixels.")
    crs: Optional[str] = Field(default=None, description="Coordinate Reference System of the area of interest.")
    gcps: Optional[GCPData] = Field(default=None, description="GCP data")
    resolution: float = Field(default=0.02, description="Resolution of the reprojection.")
    window_size: int = Field(default=64, description="Window size for the PIV interrogation or STIV spacing.")
    is_nadir: bool = Field(default=False, description="Whether the camera is nadir or not.")
    camera_matrix: Optional[List[List[float]]] = Field(default=None, description="Camera matrix of the camera.")
    dist_coeffs: Optional[List[List[float]]] = Field(default=None, description="Distortion coefficients of the camera.")
    bbox: Optional[List[List[float]]] = Field(default=None, description="Bounding (geographical) box of the AOI.")
    bbox_camera: Optional[List[List[float]]] = Field(default=None, description="Bounding box (camera) of the AOI.")
    rvec: Optional[List[float]] = Field(default=None, description="rotation vector of camera.")
    tvec: Optional[List[float]] = Field(default=None, description="translation vector of camera.")
    rotation: Optional[int] = Field(default=None, description="Image rotation in degrees.")


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


class CameraConfigInteraction(CameraConfigBase):
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
    rotation: Optional[int] = Field(default=None, description="Image rotation in degrees.")
    gcps: Optional[ControlPointSet] = Field(default=None, description="Control point set model for use in front end.")
    height: Optional[int] = Field(default=None, description="Height of the image in pixels.")
    width: Optional[int] = Field(default=None, description="Height of the image in pixels.")

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


class CameraConfigResponse(CameraConfigInteraction):
    """Response model for camera configuration.

    Fills interactive fields with data from camera configuration data.
    """

    @model_validator(mode="after")
    def populate_fields_from_data(cls, instance):
        """Populate the fields from the camera configuration data where needed, currently only placeholder."""
        if instance.data is not None:
            # load and validate data from existing pyorc camera config dict
            if instance.data.rvec is not None and instance.data.tvec is not None:
                camera_rotation, camera_position = cv.pose_world_to_camera(
                    np.array(instance.data.rvec), np.array(instance.data.tvec)
                )
                instance.camera_position, instance.camera_rotation = (
                    camera_position.tolist(),
                    camera_rotation.tolist(),
                )
            # load rotation and camera properties
            if instance.data.rotation is not None:
                instance.rotation = instance.data.rotation
            if instance.data.camera_matrix is not None:
                instance.f = instance.data.camera_matrix[0][0]
            if instance.data.dist_coeffs is not None:
                instance.k1 = instance.data.dist_coeffs[0][0]
                instance.k2 = instance.data.dist_coeffs[1][0]
            if instance.data.height is not None:
                instance.height = instance.data.height
            if instance.data.width is not None:
                instance.width = instance.data.width
            # load the gcps in appropriate fields
            if instance.data.gcps is not None:
                if instance.data.gcps.dst is not None:
                    if len(instance.data.gcps.dst) > 0:
                        if len(instance.data.gcps.dst[0]) == 2:
                            # x and y only points available
                            gcp_data = [
                                ControlPoint(
                                    x=coord[0],
                                    y=coord[1],
                                    col=point[0],
                                    row=point[1],
                                )
                                for point, coord in zip(instance.data.gcps.src, instance.data.gcps.dst)
                            ]
                        else:
                            # x, y and z coordinates available
                            gcp_data = [
                                ControlPoint(
                                    x=coord[0],
                                    y=coord[1],
                                    z=coord[2],
                                    col=point[0],
                                    row=point[1],
                                )
                                for point, coord in zip(instance.data.gcps.src, instance.data.gcps.dst)
                            ]
                        control_point_set = ControlPointSet(
                            control_points=gcp_data,
                            crs=instance.data.gcps.crs,
                            z_0=instance.data.gcps.z_0,
                            h_ref=instance.data.gcps.h_ref,
                        )
                    instance.gcps = control_point_set
            # load the bounding box and provide its fields in several forms.
            if instance.data.bbox is not None:
                cc = pyorcCameraConfig(**instance.data)
                instance.bbox = cc.bbox.exterior.bounds
                instance.bbox_camera = cc.get_bbox(camera=True).exterior.bounds
        return instance


class CameraConfigCreate(CameraConfigBase):
    """Create model for camera configuration."""

    pass


class CameraConfigUpdate(CameraConfigInteraction):
    """Update model for camera configuration.

    Fills data model with interactive fields. Reverse of CameraConfigResponse.
    """

    id: Optional[int] = Field(default=None)
    data: Optional[CameraConfigData] = Field(default=None, description="Data fields for camera config object.")

    @model_validator(mode="after")
    def populate_data_from_fields(cls, instance):
        """Populate the camera configuration data where needed."""
        instance.data.rotation = instance.rotation
        instance.data.height = instance.height
        instance.data.width = instance.width
        if instance.f is not None:
            camera_matrix = get_cam_mtx(height=instance.data.height, width=instance.data.width, focal_length=instance.f)
            instance.data.camera_matrix = camera_matrix.tolist()
        if instance.data.dist_coeffs is not None:
            dist_coeffs = np.array(instance.data.dist_coeffs)
        else:
            dist_coeffs = np.zeros((5, 1), dtype=np.float64)

        if instance.k1 is not None:
            dist_coeffs[0][0] = instance.k1
        if instance.k2 is not None:
            dist_coeffs[1][0] = instance.k2
        instance.data.dist_coeffs = dist_coeffs.tolist()
        if instance.camera_position is not None and instance.camera_rotation is not None:
            # prepare the rvec and tvec
            rvec, tvec = cv.pose_world_to_camera(np.array(instance.camera_rotation), np.array(instance.camera_position))
            instance.data.rvec, instance.data.tvec = (
                rvec.tolist(),
                tvec.tolist(),
            )
        # handle the control points
        if instance.gcps:
            if instance.gcps.control_points:
                # parse to src / dst
                src, dst = instance.gcps.parse()
            else:
                src, dst = None, None

            instance.data.gcps = GCPData(
                crs=instance.gcps.crs, src=src, dst=dst, h_ref=instance.gcps.h_ref, z_0=instance.gcps.z_0
            )
        return instance


class GCPs(BaseModel):
    """GCPs for camera configuration."""

    src: List[List[float]]  # src list of points in objective (e.g., [[col1, row1], [col2, row2]])
    dst: List[List[Optional[float]]]  # dst list of points in real-world [[x1, y1], [x2, y2], [x3, y3]]
    crs: Optional[str]  # Coordinate Reference System as a string
    height: int
    width: int
