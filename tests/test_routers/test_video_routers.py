from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api import db as models
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
        # Base.metadata.drop_all(bind=engine)
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


def test_list_videos_no_params(auth_client):
    # Create test videos
    # app.dependency_overrides[get_db] = get_db_override
    # client = TestClient(app)
    db_session = next(get_db_override())
    video1 = models.Video(timestamp=datetime.now())
    video2 = models.Video(timestamp=datetime.now() + timedelta(hours=1))
    db_session.add_all([video1, video2])
    db_session.commit()

    response = auth_client.get("/api/video/")
    assert response.status_code == 200
    assert len(response.json()) == 2
    # delete videos before continuing
    db_session.query(models.Video).delete()
    db_session.commit()
    db_session.flush()


def test_list_videos_with_time_range(auth_client):
    db_session = next(get_db_override())
    now = datetime.now()
    video1 = models.Video(timestamp=now)
    video2 = models.Video(timestamp=now + timedelta(hours=2))
    db_session.add_all([video1, video2])
    db_session.commit()

    response = auth_client.get(
        "/api/video/", params={"start": now.isoformat(), "stop": (now + timedelta(hours=1)).isoformat()}
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    db_session.query(models.Video).delete()
    db_session.commit()
    db_session.flush()


def test_list_videos_with_status(auth_client):
    db_session = next(get_db_override())
    video1 = models.Video(timestamp=datetime.now(), status=models.video.VideoStatus.NEW)  # code 1
    video2 = models.Video(timestamp=datetime.now(), status=models.video.VideoStatus.TASK)  # code 3
    db_session.add_all([video1, video2])
    db_session.commit()

    response = auth_client.get("/api/video/", params={"status": 1})
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == 1
    db_session.query(models.Video).delete()
    db_session.commit()
    db_session.flush()


def test_list_videos_with_pagination(auth_client):
    db_session = next(get_db_override())
    videos = [models.Video(timestamp=datetime.now() + timedelta(hours=i)) for i in range(5)]
    db_session.add_all(videos)
    db_session.commit()

    response = auth_client.get("/api/video/", params={"first": 2, "count": 2})
    assert response.status_code == 200
    assert len(response.json()) == 2
    db_session.query(models.Video).delete()
    db_session.commit()
    db_session.flush()


def test_sync_video(auth_client, mocker):
    """Test successful video sync."""
    mocker.patch("orc_api.schemas.video.VideoResponse.sync_remote", return_value=None)
    db_session = next(get_db_override())
    video = models.Video(timestamp=datetime(2023, 1, 1, 0, 0))
    callback_url = models.CallbackUrl(
        url="http://localhost:8000/api/callback/url", remote_site_id=1, token_refresh="test", token_access="test"
    )

    db_session.add(video)
    db_session.add(callback_url)
    db_session.commit()

    response = auth_client.post("/api/video/1/sync/")
    assert response.status_code == 200
    # call should only return status
    assert response.json()["id"] == 1


@pytest.mark.asyncio
async def test_sync_list_videos_no_site(auth_client, mocker):
    """Test sync_list_videos when no site is provided and a callback URL is not configured."""
    mocker.patch("orc_api.schemas.video.VideoResponse.sync_remote", return_value=None)
    db_session = next(get_db_override())
    videos = [models.Video(timestamp=datetime(2023, 1, 1, 0, 0) + timedelta(hours=i)) for i in range(5)]
    callback_url = models.CallbackUrl(
        url="http://localhost:8000/api/callback/url", remote_site_id=1, token_refresh="test", token_access="test"
    )

    db_session.add_all(videos)
    db_session.add(callback_url)
    db_session.commit()

    # mock_db = MagicMock()
    # mocker.patch("orc_api.crud.callback_url.get", return_value=None)
    params = {
        "start": "2023-01-01T00:00:00",
        "stop": "2023-01-02T00:00:00",
        "sync_file": True,
        "sync_image": True,
    }

    response = auth_client.post("/api/video/sync/", json=params)
    assert response.status_code == 200
    # call should only return status
    assert response.json() is None
