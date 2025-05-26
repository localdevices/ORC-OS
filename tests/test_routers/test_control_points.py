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
def cross_section_upload(cross_section_file):
    with open(cross_section_file, "r") as f:
        cs_obj = io.BytesIO(f.read().encode("utf-8"))
        # rewind io
    cs_obj.seek(0)
    # create file object
    return cs_obj


def test_from_geojson(cross_section_file, cross_section_upload):
    files = {"file": ("test.geojson", cross_section_upload, "application/json")}

    response = client.post("/control_points/from_geojson", files=files)
    print(response.json())


def test_from_csv():
    pass
