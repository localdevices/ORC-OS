"""Tests for cross section routes."""

import pytest

from orc_api import db


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


def test_get_patch_post_cross_section(auth_client, video_config_dict, db_session):
    # first add a complete video config
    r = auth_client.post("/api/video_config/", json=video_config_dict)
    assert r.status_code == 201

    # now we can test cross section routes
    r = auth_client.get("/api/cross_section/")  # this should give list of all cross sections
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    r = auth_client.get("/api/cross_section/1/")  # this should give single cross section
    print(r.json())
    assert r.status_code == 200
    assert r.json()["id"] == 1

    # get an error (camera_config instead of camera_config_id)
    r = auth_client.get("/api/cross_section/1/wetted_surface/?h=93.0&camera_config=1")
    assert r.status_code == 400
    assert "detail" in r.json()
    # check if detail is in response
    # get some surface area with a given water depth
    r = auth_client.get("/api/cross_section/1/wetted_surface/?h=93.0&camera_config_id=1")
    assert isinstance(r.json(), list)
    assert len(r.json()) > 0
    assert len(r.json()[0]) == 2  # check if camera is true
    # db_session = next(get_db_override())
    r = auth_client.get("/api/cross_section/1/wetted_surface/?h=93.0&camera_config_id=1&camera=0")
    assert isinstance(r.json(), list)
    assert len(r.json()) > 0
    assert len(r.json()[0]) == 3  # check if camera is false

    r = auth_client.get("/api/cross_section/1/csl_water_lines/?h=93.0&camera_config_id=1&camera=1")
    assert isinstance(r.json(), list)
    assert len(r.json()) > 0
    assert len(r.json()[0]) == 2  # check if camera is false

    # try a download
    r = auth_client.get("/api/cross_section/1/download/")
    assert r.status_code == 200
    # json should contain type
    assert "type" in r.json()
    # finally delete dependent video config and then the cross section
    r = auth_client.delete("/api/video_config/1/")
    assert r.status_code == 204

    r = auth_client.delete("/api/cross_section/1/")
    assert r.status_code == 204

    # remove after test
    db_session.query(db.VideoConfig).delete()
    db_session.query(db.CrossSection).delete()
    db_session.query(db.CameraConfig).delete()
    db_session.query(db.Recipe).delete()

    db_session.commit()
    db_session.flush()


def test_upload_download_cs_success(auth_client, mock_cross_section):
    r = auth_client.post("/api/cross_section/", json=mock_cross_section)
    assert r.status_code == 201
    # now try to get and download
    assert len(auth_client.get("/api/cross_section/").json()) == 1  # should only be one record
    r = auth_client.get("/api/cross_section/1/")
    assert r.status_code == 200
    r = auth_client.get("/api/cross_section/1/download/")
    assert r.status_code == 200
    assert r.headers["content-disposition"] == "attachment; filename=cross_section_1.geojson"
    # finally delete the cross section
    r = auth_client.delete("/api/cross_section/1/")
    assert r.status_code == 204
