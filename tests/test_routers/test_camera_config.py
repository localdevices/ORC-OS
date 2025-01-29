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
        "crs": None
    }

def test_fit_perspective_success(gcps_data):
    response = client.post("/camera_config/fit_perspective", json=gcps_data)
    assert response.status_code == 200
    assert response.json()["message"] == "Perspective fit successfully"
    assert response.json()["src"] == gcps_data["src"]
    assert response.json()["dst"] == gcps_data["dst"]

    def test_fit_perspective_mismatched_input_lengths():
        gcps_data = {
            "src": [[10.0, 20.0], [30.0, 40.0]],
            "dst": [[15.0, 25.0]],
            "crs": "EPSG:4326"
        }
        response = client.post("/fit_perspective", json=gcps_data)
        assert response.status_code == 400
        assert "must be the same" in response.json()["detail"]

    def test_fit_perspective_invalid_crs():
        gcps_data = {
            "src": [[10.0, 20.0], [30.0, 40.0]],
            "dst": [[15.0, 25.0], [35.0, 45.0]],
            "crs": "INVALID_CRS"
        }
        response = client.post("/fit_perspective", json=gcps_data)
        assert response.status_code == 400
        assert "Invalid CRS" in response.json()["detail"]

    def test_fit_perspective_unsupported_geographic_crs():
        gcps_data = {
            "src": [[10.0, 20.0], [30.0, 40.0]],
            "dst": [[15.0, 25.0], [35.0, 45.0]],
            "crs": "EPSG:3857"
        }
        response = client.post("/fit_perspective", json=gcps_data)
        assert response.status_code == 400
        assert "Only lat lon is supported if CRS is geographic" in response.json()["detail"]

    def test_fit_perspective_insufficient_src_coordinates():
        gcps_data = {
            "src": [],
            "dst": [[15.0, 25.0], [35.0, 45.0]],
            "crs": "EPSG:4326"
        }
        response = client.post("/fit_perspective", json=gcps_data)
        assert response.status_code == 400
        assert "The number of source and destination points must be the same" in response.json()["detail"]
