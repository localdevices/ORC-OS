import numpy as np
import pytest
from sqlalchemy.orm import Session

from orc_api.db import VideoConfig
from orc_api.schemas.video_config import VideoConfigBase


@pytest.fixture
def video_config_response(session_video_config: Session):
    # retrieve recipe
    vc_rec = session_video_config.query(VideoConfig).first()
    return VideoConfigBase.model_validate(vc_rec)


def test_video_config_schema(video_config_response):
    vc = video_config_response
    assert vc.id == 1
    assert vc.name == "some video config"
    assert "video" in vc.recipe.data


def test_video_config_transform_cs(video_config_response):
    # manipulate rvec and tvec and try it out
    vc = video_config_response
    tvec = [0.5, 10.0, 1]
    vc.tvec = tvec
    vc.rvec = [0.0, 0.0, 0.5]  # rotation only around the z-axis
    cs_transform = vc.cross_section_rt
    # check off set, vertically should be 1
    assert np.allclose(cs_transform.gdf.geometry.z - vc.cross_section.gdf.geometry.z, 1)
