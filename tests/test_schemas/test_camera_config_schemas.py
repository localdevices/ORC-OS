import pytest
from sqlalchemy.orm import Session

from orc_api.db import CameraConfig
from orc_api.schemas.camera_config import CameraConfigResponse


@pytest.fixture
def session_cam_config(session_empty, cam_config):
    c = CameraConfig(name="some camera config", data=cam_config)
    session_empty.add(c)
    session_empty.commit()
    session_empty.refresh(c)
    return session_empty


def test_camera_config_schema(session_cam_config: Session):
    # retrieve camera config
    c_rec = session_cam_config.query(CameraConfig).first()
    c = CameraConfigResponse.model_validate(c_rec)
    assert c.id == 1
    assert c.name == "some camera config"
    assert "gcps" in c.data
