import os

import pytest
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db import CallbackUrl, Recipe, SyncStatus
from orc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse
from orc_api.schemas.recipe import RecipeResponse


@pytest.fixture
def recipe_response(session_recipe: Session):
    # retrieve recipe
    r_rec = session_recipe.query(Recipe).first()
    return RecipeResponse.model_validate(r_rec)


def test_empty_recipe():
    recipe = RecipeResponse()
    # check if id is None
    assert recipe.id is None
    # check if end_frame is the default value
    assert recipe.end_frame == 108000


def test_recipe_schema(recipe_response):
    # retrieve recipe
    r = recipe_response
    assert r.id == 1
    assert r.name == "some recipe"
    assert "video" in r.data


def test_recipe_sync(session_recipe, recipe_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on institute 1
    institute = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None):
        class MockResponse:
            status_code = 201

            def json(self):
                return {
                    "id": 4,
                    "name": recipe_response.name,
                    "data": recipe_response.data,
                    "institute": institute,
                }

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_recipe)
    monkeypatch.setattr("orc_api.schemas.recipe.get_session", lambda: session_recipe)
    recipe_update = recipe_response.sync_remote(institute=institute)
    assert recipe_update.remote_id == 4
    assert recipe_update.sync_status == SyncStatus.SYNCED


def test_recipe_sync_not_permitted(session_recipe, recipe_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    institute = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None):
        class MockResponse:
            status_code = 403

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_recipe)
    monkeypatch.setattr("orc_api.schemas.recipe.get_session", lambda: session_recipe)
    with pytest.raises(ValueError, match="Remote update failed with status code 403."):
        _ = recipe_response.sync_remote(institute=institute)


@pytest.mark.skipif(
    not os.getenv("LIVEORC_URL") or not os.getenv("LIVEORC_EMAIL") or not os.getenv("LIVEORC_PASSWORD"),
    reason="This test requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set",
)
def test_recipe_sync_real_server(session_recipe, recipe_response, monkeypatch):
    """Test for syncing a cross-section to a real remote API.

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
    crud.callback_url.add(session_recipe, new_callback_url)

    # now we have access through the temporary database. Let's perform a post.
    monkeypatch.setattr("orc_api.schemas.recipe.get_session", lambda: session_recipe)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_recipe)

    recipe_update = recipe_response.sync_remote(institute=1)
    print(recipe_update)
