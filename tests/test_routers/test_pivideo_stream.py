"""Test raspberry pi video routers."""

import sys
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from orc_api.routers import pivideo_stream
from orc_api.routers.pivideo_stream import start_camera

app = FastAPI()
mock_controls = MagicMock()
mock_controls.AfModeEnum.Manual = 2
pivideo_stream.controls = mock_controls
app.include_router(pivideo_stream.router)

client = TestClient(app)

# # mock the picamera2 library
sys.modules["picamera2"] = MagicMock()
sys.modules["picamera2.Picamera2"] = MagicMock()

# start after mocking the library
# from orc_api.routers.pivideo_stream import start_camera


def test_has_picam_true(mocker):
    """Test has_picam when the camera is available."""
    mocker.patch("orc_api.routers.pivideo_stream.picam_available", True)
    response = client.get("/pivideo_stream/has_picam")
    assert response.status_code == 200
    assert response.json() is True


def test_has_picam_false(mocker):
    """Test has_picam when the camera is not available."""
    mocker.patch("orc_api.routers.pivideo_stream.picam_available", False)
    response = client.get("/pivideo_stream/has_picam")
    assert response.status_code == 200
    assert response.json() is False


def test_start_camera_no_picamera2_library(monkeypatch):
    """Test start_camera when picamera2 library is unavailable."""
    monkeypatch.setattr("orc_api.routers.pivideo_stream.picam_available", False)
    with pytest.raises(HTTPException) as exc_info:
        start_camera()
    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "picamera2 library is not installed."


def test_start_camera_invalid_camera_index(monkeypatch):
    """Test start_camera with an invalid camera index."""
    monkeypatch.setattr("orc_api.routers.pivideo_stream.picam_available", True)
    monkeypatch.setattr(
        "orc_api.routers.pivideo_stream.get_cameras",
        lambda: [{"id": 0, "Model": "camera_1"}, {"id": 1, "Model": "camera_2"}],
    )
    with pytest.raises(HTTPException) as exc_info:
        # choose a ridiculous camera index
        start_camera(camera_idx=5)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid camera_index 5. Available indexes: 0..1"


def test_start_camera_no_cameras_detected(monkeypatch):
    """Test start_camera when no cameras are detected."""
    monkeypatch.setattr("orc_api.routers.pivideo_stream.picam_available", True)
    monkeypatch.setattr("orc_api.routers.pivideo_stream.get_cameras", lambda: [])
    with pytest.raises(HTTPException) as exc_info:
        start_camera(camera_idx=0)
    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "No cameras detected."


def test_start_camera_success(monkeypatch):
    """Test start_camera success with default parameters."""
    monkeypatch.setattr("orc_api.routers.pivideo_stream.picam_available", True)
    # Mock libcamera controls before importing pivideo_stream

    # monkeypatch.setattr("picamera2.Picamera2", mock_picamera)
    # monkeypatch.setattr("orc_api.routers.pivideo_stream.picamera2.Picamera2", mock_picamera)
    mock_camera_info = [{"id": 0, "Model": "camera_1"}, {"id": 1, "Model": "camera_2"}]

    monkeypatch.setattr("orc_api.routers.pivideo_stream.get_cameras", lambda: mock_camera_info)

    _ = start_camera(camera_idx=0, width=1280, height=720, fps=60)
