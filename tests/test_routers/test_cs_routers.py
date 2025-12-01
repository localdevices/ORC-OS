import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api.database import get_db
from orc_api.db import Base
from orc_api.main import app

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_override():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = get_db_override
app.state.session = next(get_db_override())
client = TestClient(app)


@pytest.fixture
def auth_client():
    # credentials = HTTPBasicCredentials(password="welcome123")
    credentials = {"password": "welcome123"}
    # first create the password
    _ = client.post("/api/auth/set_password/", params=credentials)
    response = client.post("/api/auth/login/", params=credentials)
    assert response.status_code == 200
    return TestClient(app, cookies=response.cookies)


@pytest.fixture
def mock_cross_section():
    # make a triangular shaped cross section
    return {
        "id": 1,
        "name": "Test Cross Section",
        "features": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"_ID": 1, "id": 1},
                    "geometry": {"type": "Point", "coordinates": [0, 0, 0]},
                },
                {
                    "type": "Feature",
                    "properties": {"_ID": 2, "id": 2},
                    "geometry": {"type": "Point", "coordinates": [0, 1, -1]},
                },
                {
                    "type": "Feature",
                    "properties": {"_ID": 2, "id": 2},
                    "geometry": {"type": "Point", "coordinates": [0, 2, 0]},
                },
            ],
        },
    }


def test_upload_download_cs_success(auth_client, mock_cross_section):
    r = auth_client.post("/api/cross_section/", json=mock_cross_section)
    assert r.status_code == 201
    # now try to get and download
    r = auth_client.get("/api/cross_section/1/")
    assert r.status_code == 200
    r = client.get("/api/cross_section/1/download/")
    assert r.status_code == 200
    assert r.headers["content-disposition"] == "attachment; filename=cross_section_1.geojson"
    # finally delete the cross section
    r = auth_client.delete("/api/cross_section/1/")
    assert r.status_code == 204
