"""Tests for camera config schemas."""

import pytest
from pyorc import CameraConfig as pyorcCameraConfig
from sqlalchemy.orm import Session

from orc_api.db import CameraConfig
from orc_api.schemas.camera_config import CameraConfigData, CameraConfigResponse


@pytest.fixture
def bbox_points():
    """Reasonable estimates for bounding box points."""
    return [[200, 200], [1700, 900], [500, 250]]


def test_camera_config_schema(session_cam_config: Session):
    """Test for retrieving a camera config."""
    # retrieve camera config
    c_rec = session_cam_config.query(CameraConfig).first()
    c = CameraConfigResponse.model_validate(c_rec)
    assert c.id == 1
    assert c.name == "some camera config"
    assert hasattr(c.data, "gcps")


def test_camera_config_set_bbox(session_cam_config: Session, bbox_points):
    """Set a new camera bounding box and test if the field are coming box in the response object."""
    # retrieve camera config
    c_rec = session_cam_config.query(CameraConfig).first()
    c = CameraConfigResponse.model_validate(c_rec)
    cc = pyorcCameraConfig(**c.data.model_dump())
    cc.set_bbox_from_width_length(bbox_points)
    cam_response = CameraConfigResponse(data=CameraConfigData.model_validate(cc.to_dict_str()))
    assert cam_response.data.bbox != c.data.bbox
