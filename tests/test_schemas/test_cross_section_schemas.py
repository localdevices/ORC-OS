import os
from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db import CallbackUrl, CrossSection, SyncStatus
from orc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse
from orc_api.schemas.cross_section import CrossSectionResponse


def liveorc_access():
    # check if env variables are present to perform liveorc test
    access = True
    if os.getenv("LIVEORC_URL") is None:
        access = False
    if os.getenv("LIVEORC_EMAIL") is None:
        access = False
    if os.getenv("LIVEORC_PASSWORD") is None:
        access = False
    return access


@pytest.fixture
def cross_section_response(session_cross_section: Session):
    # retrieve cross section
    cs_rec = session_cross_section.query(CrossSection).first()
    return CrossSectionResponse.model_validate(cs_rec)


def test_cross_section_schema(cross_section_response):
    # check if crs is available
    assert cross_section_response.crs is not None


def test_cross_section_sync(session_cross_section, cross_section_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, files=None):
        class MockResponse:
            status_code = 201

            def json(self):
                return {
                    "id": 3,
                    "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "name": cross_section_response.name,
                    "data": cross_section_response.features,
                    "timestamp": cross_section_response.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "site": site,
                }

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.cross_section.get_session", lambda: session_cross_section)
    cross_section_update = cross_section_response.sync_remote(site=1)
    assert cross_section_update.remote_id == 3
    assert cross_section_update.sync_status == SyncStatus.SYNCED


def test_cross_section_sync_not_permitted(session_cross_section, cross_section_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, files=None):
        class MockResponse:
            status_code = 403

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.cross_section.get_session", lambda: session_cross_section)
    with pytest.raises(ValueError, match="Remote update failed with status code 403."):
        _ = cross_section_response.sync_remote(site=site)


@pytest.mark.skipif(
    liveorc_access() == False, reason="This test requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set"
)
def test_cross_section_sync_real_server(session_cross_section, cross_section_response, monkeypatch):
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
    crud.callback_url.add(session_cross_section, new_callback_url)

    # now we have access through the temporary database. Let's perform a post.
    monkeypatch.setattr("orc_api.schemas.cross_section.get_session", lambda: session_cross_section)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_cross_section)

    cross_section_update = cross_section_response.sync_remote(site=1)
    print(cross_section_update)
