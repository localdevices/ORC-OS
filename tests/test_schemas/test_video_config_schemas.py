import os

import numpy as np
import pytest

from orc_api import crud
from orc_api.db import CallbackUrl, SyncStatus
from orc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse
from orc_api.schemas.recipe import RecipeRemote


def test_video_config_schema(video_config_response):
    vc = video_config_response
    assert vc.id == 1
    assert vc.name == "some video config"
    assert "video" in vc.recipe.data


def test_video_config_transform_cs(video_config_response):
    # manipulate rvec and tvec and try it out
    vc = video_config_response
    tvec = [0.5, 10.0, 1]
    vc.tvec = tvec
    vc.rvec = [0.0, 0.0, 0.5]  # rotation only around the z-axis
    cs_transform = vc.cross_section_rt
    # check off set, vertically should be 1
    assert np.allclose(cs_transform.gdf.geometry.z - vc.cross_section.gdf.geometry.z, 1)


def test_video_config_recipe_cleaned(video_config_response):
    vc = video_config_response
    tvec = [0.0, 0.0, 1]
    vc.tvec = tvec
    # vc.rvec = [0.0, 0.0, 0.5]  # rotation only around the z-axis
    new_z = vc.recipe_transect_filled.data["transect"]["transect_1"]["geojson"]["features"][0]["geometry"][
        "coordinates"
    ][-1]
    orig_z = vc.cross_section.features["features"][0]["geometry"]["coordinates"][-1]
    assert np.isclose(new_z - orig_z, 1)


def test_recipe_sync(session_video_config, video_config_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None):
        class MockResponse:
            status_code = 201

            def json(self):
                return {
                    "id": 5,
                    "name": video_config_response.name,
                    "camera_config": {"some": "data"},
                    "recipe": 4,
                    "profile": 3,
                    "server": 0,
                }

        return MockResponse()

    # ensure that only relevant parts of code are tested.
    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    # we here already store recipe and cross section in database with SYNCED statusses. This prevents syncing.
    video_config_response.recipe.sync_status = SyncStatus.SYNCED
    video_config_response.recipe.remote_id = 4
    # prepare remote recipe for update
    recipe_remote = RecipeRemote.model_validate(video_config_response.recipe.model_dump(exclude_none=True))
    crud.recipe.update(session_video_config, 1, recipe_remote.model_dump())
    video_config_response.cross_section.sync_status = SyncStatus.SYNCED
    video_config_response.cross_section.remote_id = 3
    crud.cross_section.update(
        session_video_config,
        1,
        video_config_response.cross_section.model_dump(
            include=["id", "created_at", "remote_id", "sync_status", "timestamp", "name", "features"]
        ),
    )

    # ensure that we load the right session
    def mock_get_site(self, site_id):
        class MockResponse:
            status_code = 200

            def json(self):
                return {"institute": 1}

        return MockResponse()

    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.schemas.video_config.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.schemas.callback_url.CallbackUrlResponse.get_site", mock_get_site)
    video_config_update = video_config_response.sync_remote(site=site)

    # check if remote ids are coming through in the response model
    assert video_config_update.recipe.remote_id == 4
    assert video_config_update.cross_section.remote_id == 3
    assert video_config_update.remote_id == 5
    assert video_config_update.sync_status == SyncStatus.SYNCED


def test_video_config_sync_not_permitted(session_video_config, video_config_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None):
        class MockResponse:
            status_code = 403

        return MockResponse()

    # ensure that we load the right session

    def mock_get_site(self, site_id):
        class MockResponse:
            status_code = 200

            def json(self):
                return {"institute": 1}

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.schemas.video_config.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.schemas.callback_url.CallbackUrlResponse.get_site", mock_get_site)

    with pytest.raises(ValueError, match="Remote update failed with status code 403."):
        _ = video_config_response.sync_remote(site=site)


@pytest.mark.skipif(
    not os.getenv("LIVEORC_URL") or not os.getenv("LIVEORC_EMAIL") or not os.getenv("LIVEORC_PASSWORD"),
    reason="This test requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set",
)
def test_video_config_sync_real_server(session_video_config, video_config_response, monkeypatch):
    """Test for syncing a full video configuration to a real remote API.

    This requires setting LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD environment variables.
    You must have access to the remote API to run this test and have site=1 available on the remote API.
    """
    # first patch the liveorc access
    callback_create = CallbackUrlCreate(
        url=os.getenv("LIVEORC_URL"),
        user=os.getenv("LIVEORC_EMAIL"),
        password=os.getenv("LIVEORC_PASSWORD"),
    )
    tokens = callback_create.get_tokens().json()
    new_callback_dict = callback_create.model_dump(exclude_none=True, mode="json", exclude={"id", "password", "user"})
    # add our newly found information from LiveORC server
    new_callback_dict.update(
        {
            "token_access": tokens["access"],
            "token_refresh": tokens["refresh"],
            "token_expiration": callback_create.get_token_expiration(),
        }
    )
    new_callback_url = CallbackUrl(**new_callback_dict)
    crud.callback_url.add(session_video_config, new_callback_url)

    # now we have access through the temporary database. Let's perform a post.
    monkeypatch.setattr("orc_api.schemas.video_config.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.schemas.recipe.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.schemas.cross_section.get_session", lambda: session_video_config)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_video_config)

    video_config_update = video_config_response.sync_remote(site=1)
    print(video_config_update)
