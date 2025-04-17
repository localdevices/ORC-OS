# tests/test_camera_config.py

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import Base
from orc_api.main import app
from orc_api.schemas.water_level import WaterLevelCreate, WaterLevelResponse

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_override():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_get_wl_settings_empty():
    app.dependency_overrides[get_db] = get_db_override
    client = TestClient(app)
    response = client.get("/water_level/")
    assert response.status_code == 200
    assert response.json() is None


def test_post_wl_settings():
    wl_settings = WaterLevelCreate()
    wl = wl_settings.model_dump(exclude_none=True)
    app.dependency_overrides[get_db] = get_db_override
    client = TestClient(app)
    response = client.post("/water_level/", json=wl)
    assert response.status_code == 201
    # check if database is updated
    session = next(get_db_override())
    assert crud.water_level.get(session).id == 1
    # check if a Response model is returned from get
    response = client.get("/water_level/")
    WaterLevelResponse.model_validate(response.json())
