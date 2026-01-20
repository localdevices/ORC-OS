import copy
import os
from datetime import datetime, timedelta

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api import db as models
from orc_api.database import get_db
from orc_api.db import Base
from orc_api.main import app
from orc_api.routers.ws.video import WSVideoState
from orc_api.schemas.video import VideoResponse
from orc_api.schemas.video_config import VideoConfigResponse
from orc_api.utils import queue

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
    app.state.executor = queue.PriorityThreadPoolExecutor(max_workers=1)  # ThreadPoolExecutor(max_workers=1)
    client = TestClient(app)
    # credentials = HTTPBasicCredentials(password="welcome123")
    credentials = {"password": "welcome123"}
    # first create the password
    _ = client.post("/api/auth/set_password/", params=credentials)
    response = client.post("/api/auth/login/", params=credentials)
    assert response.status_code == 200
    return TestClient(app, cookies=response.cookies)


def test_video_details_log_delete(auth_client, tmpdir, monkeypatch):
    upload_dir = os.path.join(tmpdir, "uploads")
    monkeypatch.setattr("orc_api.routers.video.UPLOAD_DIRECTORY", upload_dir)
    monkeypatch.setattr("orc_api.UPLOAD_DIRECTORY", upload_dir)

    # add some videos
    db_session = next(get_db_override())
    video1 = models.Video(
        timestamp=datetime.now(),
        file=os.path.join(upload_dir, "test_video.mp4"),
        thumbnail="thumbnail.jpg",
        image="image.jpg",
    )
    video2 = models.Video(timestamp=datetime.now() + timedelta(hours=1))

    db_session.add_all([video1, video2])
    db_session.commit()
    # get details, log play, and so on
    r = auth_client.get("/api/video/1/")
    assert r.status_code == 200
    r = auth_client.get("/api/video/1/log/")
    assert r.status_code == 404
    r = auth_client.get("/api/video/1/thumbnail/")
    assert r.status_code == 404
    r = auth_client.get("/api/video/1/image/")
    assert r.status_code == 404
    # now patch the log file, a image, thumbnail with tmpdir file
    log_file = os.path.join(upload_dir, "pyorc.log")
    image_file = os.path.join(upload_dir, "image.jpg")
    thumbnail_file = os.path.join(upload_dir, "thumbnail.jpg")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    img = np.array([[0, 255], [255, 0]], np.uint8)
    img = Image.fromarray(np.stack([img, img, img], axis=-1))
    with open(log_file, "w") as f:
        f.write("log test")
    img.save(image_file)
    img.save(thumbnail_file)
    r = auth_client.get("/api/video/1/log/")
    assert r.status_code == 200
    # let's try to get a thumbnail, frame and play
    r = auth_client.get("/api/video/1/thumbnail/")
    assert r.status_code == 200
    r = auth_client.get("/api/video/1/image/")
    assert r.status_code == 200
    # finally delete video, also check if log file is removed
    r = auth_client.delete("/api/video/1/")
    assert r.status_code == 204
    assert not os.path.exists(log_file)
    db_session.query(models.Video).delete()
    db_session.commit()
    db_session.flush()


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
    # also check count end point
    response = auth_client.get("/api/video/count/")
    assert response.status_code == 200
    print(response.json())
    assert response.json() == 2
    # also test routes with failing parameters, these should give 400 errors
    r = auth_client.get("/api/video/?status=10")
    assert r.status_code == 400
    assert "Invalid status value" in r.json()["detail"]
    r = auth_client.get("/api/video/count/?sync_status=10")
    assert r.status_code == 400
    assert "Invalid sync status value" in r.json()["detail"]

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
    mocker.patch("orc_api.schemas.video.VideoResponse.sync_remote_wrapper", return_value=None)
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
    mocker.patch("orc_api.schemas.video.VideoResponse.sync_remote_wrapper", return_value=None)
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
    # call should return a list of dicts with each dict having "sync_status": 5 (queued)
    assert all([rec["sync_status"] == 5 for rec in response.json()])


def test_video_websocket(auth_client, video_config_dict):
    # add a video
    db_session = next(get_db_override())
    video1 = models.Video(timestamp=datetime.now(), status=models.video.VideoStatus.NEW)  # code 1
    db_session.add_all([video1])
    db_session.commit()
    db_session.refresh(video1)
    # add the video to video_config_dict
    video_config_dict["sample_video_id"] = video1.id
    response = auth_client.post("/api/video_config/", json=video_config_dict)
    # attach video_config to video1
    video_config_stored = VideoConfigResponse.model_validate(response.json())
    video1.video_config_id = video_config_stored.id
    db_session.commit()
    db_session.refresh(video1)
    # make a web socket item
    vs = WSVideoState(video=VideoResponse.model_validate(video1), saved=True)
    vs_c = copy.deepcopy(vs)
    msg = {"op": "rotate_translate_bbox", "params": {"angle": 1.2}}
    vs_c.update_video_config(**msg)
    assert vs_c.video.video_config.camera_config.bbox != vs.video.video_config.camera_config.bbox
    print(vs.video)
