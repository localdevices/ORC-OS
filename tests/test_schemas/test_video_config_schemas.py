from sqlalchemy.orm import Session

from orc_api.db import VideoConfig
from orc_api.schemas.video_config import VideoConfigBase


def test_recipe_schema(session_video_config: Session):
    # retrieve recipe
    vc_rec = session_video_config.query(VideoConfig).first()
    vc = VideoConfigBase.model_validate(vc_rec)
    assert vc.id == 1
    assert vc.name == "some video config"
    assert "video" in vc.recipe.data
