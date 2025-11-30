import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api.database import get_db
from orc_api.db import Base
from orc_api.main import app
from orc_api.schemas.video_config import VideoConfigBase, VideoConfigResponse

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_override():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_db] = get_db_override
    app.state.session = next(get_db_override())

    client = TestClient(app)
    # credentials = HTTPBasicCredentials(password="welcome123")
    credentials = {"password": "welcome123"}
    # first create the password
    _ = client.post("/api/auth/set_password/", params=credentials)
    response = client.post("/api/auth/login/", params=credentials)
    assert response.status_code == 200
    return TestClient(app, cookies=response.cookies)


def test_add_filled_video_config(recipe, cross_section, cam_config, auth_client):
    recipe = json.loads(recipe)
    video_config = VideoConfigBase(
        name="hello",
        recipe={"name": "some_name", "data": recipe},
        camera_config={"name": "some_cam_config", "data": cam_config},
        cross_section={"name": "some_cross_section", "features": cross_section},
        cross_section_wl={"name": "some_cross_section_wl", "features": cross_section},
    )
    video_config_dict = video_config.model_dump(exclude_none=True, mode="json")
    response = auth_client.post("/api/video_config", json=video_config_dict)
    video_config_stored = VideoConfigResponse.model_validate(response.json())
    video_config_base = VideoConfigBase.model_validate(response.json())
    assert response.status_code == 201
    # if everything went well, the attributes should be in the database and all have an id.
    assert video_config_stored.id == 1
    assert video_config_stored.recipe.id == 1
    # now try to change one field (name) of a underlying attribute and try the post again. id should NOT change
    # but name should!
    video_config_base.recipe.name = "new_name"
    video_config_base.cross_section.name = "new_name_cs"
    video_config_base.cross_section_wl.name = "new_name_cs_wl"
    video_config_base.camera_config.name = "new_name_cam_config"
    video_config_dict = video_config_base.model_dump(exclude_none=True, mode="json")
    response = auth_client.post("/api/video_config", json=video_config_dict)
    video_config_update = VideoConfigResponse.model_validate(response.json())
    assert video_config_update.id == 1
    assert video_config_update.recipe.id == 1
    assert video_config_update.recipe.name == "new_name"
    assert video_config_update.camera_config.id == 1
    assert video_config_update.camera_config.name == "new_name_cam_config"
    assert video_config_update.cross_section.id == 1
    assert video_config_update.cross_section.name == "new_name_cs"
    assert video_config_update.cross_section_wl.id == 2  # cross section is stored twice
    assert video_config_update.cross_section_wl.name == "new_name_cs_wl"


def test_add_empty_video_config(auth_client):
    video_config = VideoConfigBase(name="hello")
    video_config_dict = video_config.model_dump(exclude_none=True)
    _ = auth_client.get("/api/callback_url")
    response = auth_client.post("/api/video_config", json=video_config_dict)
    assert response.status_code == 201
