import os

import pytest
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db import CallbackUrl, SyncStatus, TimeSeries
from orc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse
from orc_api.schemas.time_series import TimeSeriesResponse


@pytest.fixture
def time_series_response(session_video_with_config: Session):
    # retrieve recipe
    ts_rec = session_video_with_config.query(TimeSeries).first()
    return TimeSeriesResponse.model_validate(ts_rec)


def test_time_series_sync(session_video_with_config, time_series_response, monkeypatch):
    """Test for syncing a time series record to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, files=None):
        class MockResponse:
            status_code = 201

            def json(self):
                return {
                    "id": 10,
                    "timestamp": time_series_response.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "h": time_series_response.h,
                    "site": site,
                }

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.time_series.get_session", lambda: session_video_with_config)
    time_series_update = time_series_response.sync_remote(site=site)
    assert time_series_update.remote_id == 10
    assert time_series_update.sync_status == SyncStatus.SYNCED


def test_time_series_sync_not_permitted(session_video_with_config, time_series_response, monkeypatch):
    """Test for syncing a time series record to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, files=None):
        class MockResponse:
            status_code = 403

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.time_series.get_session", lambda: session_video_with_config)
    with pytest.raises(ValueError, match="Remote update failed with status code 403."):
        _ = time_series_response.sync_remote(site=site)


@pytest.mark.skipif(
    not os.getenv("LIVEORC_URL") or not os.getenv("LIVEORC_EMAIL") or not os.getenv("LIVEORC_PASSWORD"),
    reason="This test requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set",
)
def test_time_series_sync_real_server(session_video_with_config, time_series_response, monkeypatch):
    """Test for syncing a time series record to a real remote API.

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
    crud.callback_url.add(session_video_with_config, new_callback_url)

    # now we have access through the temporary database. Let's perform a post.
    monkeypatch.setattr("orc_api.schemas.time_series.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_video_with_config)

    time_series_update = time_series_response.sync_remote(site=1)
    print(time_series_update)
