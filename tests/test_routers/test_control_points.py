import io

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from orc_api.routers import control_points

# make a test app
app = FastAPI()
app.include_router(control_points.router)

client = TestClient(app)


@pytest.fixture
def cross_section_upload_json(cross_section_file):
    with open(cross_section_file, "r") as f:
        cs_obj = io.BytesIO(f.read().encode("utf-8"))
        # rewind io
    cs_obj.seek(0)
    # create file object
    return cs_obj


@pytest.fixture
def cross_section_upload_csv():
    xs = [0, 1, 2]
    ys = [2, 3, 4]
    zs = [0, -1, 0]
    # make some data and write to BytesIO
    xyz_str = "x,y,z\n"
    for x, y, z in zip(xs, ys, zs):
        xyz_str += f"{x},{y},{z}\n"
    cs_obj = io.BytesIO(xyz_str.encode("utf-8"))
    cs_obj.seek(0)
    return cs_obj


def test_from_geojson(cross_section_file, cross_section_upload_json):
    files = {"file": ("test.geojson", cross_section_upload_json, "application/json")}
    response = client.post("/control_points/from_geojson", files=files)
    print(response.json())


def test_from_csv(cross_section_upload_csv):
    files = {"file": ("test.csv", cross_section_upload_csv, "application/csv")}
    response = client.post("/control_points/from_csv", files=files)
    print(response.json())
