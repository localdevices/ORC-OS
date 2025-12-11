import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api.database import get_db
from orc_api.db import Base
from orc_api.main import app
from orc_api.schemas.video_config import VideoConfigBase

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
def db_session():
    """Get a dedicated db session."""
    return next(get_db_override())


@pytest.fixture
def video_config_dict(recipe, cross_section, cam_config):
    recipe = json.loads(recipe)
    video_config = VideoConfigBase(
        name="hello",
        recipe={"name": "some_name", "data": recipe},
        camera_config={"name": "some_cam_config", "data": cam_config},
        cross_section={"name": "some_cross_section", "features": cross_section},
        cross_section_wl={"name": "some_cross_section_wl", "features": cross_section},
    )
    return video_config.model_dump(exclude_none=True, mode="json")


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
