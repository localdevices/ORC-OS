# tests/test_camera_config.py

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from orc_api.routers import camera_config, control_points

app = FastAPI()
app.include_router(camera_config.router)
app.include_router(control_points.router)

client = TestClient(app)


@pytest.fixture
def gcps_data():
    src = [[158, 314], [418, 245], [655, 162], [948, 98], [1587, 321], [1465, 747]]
    dst = [
        [192102.50255553858, 313157.5882846481, 150.831],
        [192101.3882378415, 313160.1101843005, 150.717],
        [192099.77023223988, 313163.2868999007, 150.807],
        [192096.8922817797, 313169.2557434712, 150.621],
        [192105.2958125107, 313172.0257530752, 150.616],
        [192110.35620407888, 313162.5371485311, 150.758],
    ]
    control_points = [
        {"x": _dst[0], "y": _dst[1], "z": _dst[2], "col": _src[0], "row": _src[1]} for _dst, _src in zip(dst, src)
    ]
    return {"control_points": control_points, "crs": 28992, "z_0": 150.49, "h_ref": 92.45}


@pytest.fixture
def gcps_data_lat_lon():
    src = [[158, 314], [418, 245], [655, 162], [948, 98], [1587, 321], [1465, 747]]
    dst = [
        [5.913539646666668, 50.80710705166666, 150.831],
        [5.913524096666666, 50.80712979166666, 150.717],
        [5.913501468333333, 50.80715845, 150.807],
        [5.913461251666667, 50.80721228666666, 150.621],
        [5.913580743333333, 50.80723664166667, 150.616],
        [5.91365156, 50.80715102666666, 150.758],
    ]
    control_points = [
        {"x": _dst[0], "y": _dst[1], "z": _dst[2], "col": _src[0], "row": _src[1]} for _dst, _src in zip(dst, src)
    ]
    return {"control_points": control_points, "crs": 28992, "z_0": 150.49, "h_ref": 92.45}


@pytest.fixture
def fit_data(gcps_data):
    """Add height and width."""
    return {
        "gcps": gcps_data,
        "height": 1080,
        "width": 1920,
    }


@pytest.fixture
def fit_data_lat_lon(gcps_data_lat_lon):
    """Add height and width."""
    return {
        "gcps": gcps_data_lat_lon,
        "height": 1080,
        "width": 1920,
    }


def test_fit_perspective_success(fit_data):
    response = client.post("/control_points/fit_perspective", json=fit_data)
    assert response.status_code == 200
    assert "src_est" in response.json()
    assert "dst_est" in response.json()


def test_fit_perspective_lat_lon_success(fit_data_lat_lon):
    response = client.post("/control_points/fit_perspective", json=fit_data_lat_lon)
    assert response.status_code == 200
    assert "src_est" in response.json()
    assert "dst_est" in response.json()


def test_fit_perspective_insufficient_coordinates(fit_data):
    # reduce nr of points
    fit_data["gcps"]["control_points"] = fit_data["gcps"]["control_points"][:-1]

    response = client.post("/control_points/fit_perspective", json=fit_data)
    assert response.status_code == 400
    assert "must be at least 6" in response.json()["detail"]


def test_fit_perspective_invalid_crs(fit_data):
    fit_data["gcps"]["crs"] = "invalid"
    response = client.post("/control_points/fit_perspective", json=fit_data)
    assert response.status_code == 400
    assert "Invalid CRS" in response.json()["detail"]
