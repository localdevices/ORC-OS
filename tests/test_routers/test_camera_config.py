# tests/test_camera_config.py

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from nodeorc_api.routers import camera_config
from nodeorc_api.schemas.camera_config import GCPs

app = FastAPI()
app.include_router(camera_config.router)

client = TestClient(app)


@pytest.fixture
def gcps_data():
    return {
        "src": [[158, 314], [418, 245], [655, 162], [948, 98], [1587, 321],[1465, 747]],
        "dst": [
            [192102.50255553858, 313157.5882846481, 150.831],
            [192101.3882378415, 313160.1101843005, 150.717],
            [192099.77023223988, 313163.2868999007, 150.807],
            [192096.8922817797, 313169.2557434712, 150.621],
            [192105.2958125107, 313172.0257530752, 150.616],
            [192110.35620407888, 313162.5371485311, 150.758],
        ],
        "crs": None,
        "height": 1080,
        "width": 1920

    }

def test_fit_perspective_success(gcps_data):
    response = client.post("/camera_config/fit_perspective", json=gcps_data)
    assert response.status_code == 200
    assert "src_est" in response.json()
    assert "dst_est" in response.json()

def test_fit_perspective_mismatched_input_lengths(gcps_data):
    # reduce nr of points
    gcps_data["src"] = gcps_data["src"][:-1]

    response = client.post("/camera_config/fit_perspective", json=gcps_data)
    assert response.status_code == 400
    assert "must be the same" in response.json()["detail"]

def test_fit_perspective_invalid_crs(gcps_data):
    gcps_data["crs"] = "invalid"
    response = client.post("/camera_config/fit_perspective", json=gcps_data)
    assert response.status_code == 400
    assert "Invalid CRS" in response.json()["detail"]


def test_fit_perspective_insufficient_src_coordinates(gcps_data):
    # reduce nr of points by one
    gcps_data["src"] = gcps_data["src"][:-1]
    gcps_data["dst"] = gcps_data["dst"][:-1]
    response = client.post("/camera_config/fit_perspective", json=gcps_data)
    assert response.status_code == 400
    assert "The number of control points must be at least" in response.json()["detail"]
