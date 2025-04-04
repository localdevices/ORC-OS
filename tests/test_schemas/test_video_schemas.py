import os
from datetime import datetime

import pytest
from pyorc import sample_data

from orc_api import crud
from orc_api import db as models
from orc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse


@pytest.mark.skip(reason="Testing full video run only done on interactive request.")
def test_video_run(
    video_response,
    session_video_config,
    monkeypatch,
):
    monkeypatch.setattr("orc_api.schemas.video.get_session", lambda: session_video_config)
    assert video_response.status == models.VideoStatus.NEW
    video_response.run(base_path=sample_data.get_hommerich_pyorc_files())
    assert video_response.status == models.VideoStatus.DONE
    assert len(video_response.get_netcdf_files(base_path=sample_data.get_hommerich_pyorc_files())) > 0
    assert video_response.get_discharge_file(base_path=sample_data.get_hommerich_pyorc_files()) is not None
    # check if the time series has been updated
    ts = session_video_config.query(models.TimeSeries).filter(models.TimeSeries.id == 1).first()
    # q_50 should be available
    assert ts.q_50 is not None
    # check if video got updated also
    video = session_video_config.query(models.Video).filter(models.Video.id == 1).first()
    assert video.image is not None


@pytest.mark.skip(reason="Testing full video run without water level only done on interactive request.")
def test_video_run_no_waterlevel(video_response_no_ts, session_video_config, monkeypatch):
    monkeypatch.setattr("orc_api.schemas.video.get_session", lambda: session_video_config)
    assert video_response_no_ts.time_series is None
    video_response_no_ts.run(base_path=sample_data.get_hommerich_pyorc_files())
    assert video_response_no_ts.time_series is not None
    assert video_response_no_ts.status == models.VideoStatus.DONE
    assert len(video_response_no_ts.get_netcdf_files(base_path=sample_data.get_hommerich_pyorc_files())) > 0
    assert video_response_no_ts.get_discharge_file(base_path=sample_data.get_hommerich_pyorc_files()) is not None


def test_video_sync(session_video_with_config, video_response, monkeypatch):
    """Test for syncing a video record to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1
    institute = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None):
        class MockResponse:
            status_code = 201

            def json(self):
                return {
                    "id": 7,
                    "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "timestamp": video_response.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "camera_config": 1,
                    "file": "some/file/path.mp4",
                    "image": "some/file/path.jpg",
                }

        return MockResponse()

    # we here already store recipe and cross section in database with SYNCED statusses. This prevents syncing.
    video_response.video_config.sync_status = models.SyncStatus.SYNCED
    video_response.video_config.remote_id = 5
    crud.video_config.update(session_video_with_config, 1, {"sync_status": models.SyncStatus.SYNCED, "remote_id": 5})
    video_response.time_series.sync_status = models.SyncStatus.SYNCED
    video_response.time_series.remote_id = 7
    crud.time_series.update(session_video_with_config, 1, video_response.time_series.model_dump(exclude_none=True))

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.video.get_session", lambda: session_video_with_config)
    video_update = video_response.sync_remote(
        base_path=sample_data.get_hommerich_pyorc_files(), site=site, institute=institute
    )
    assert video_update.remote_id == 7
    assert video_update.sync_status == models.SyncStatus.SYNCED


def test_video_sync_not_permitted(session_video_with_config, video_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    institute = 1
    site = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None):
        class MockResponse:
            status_code = 403

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.video.get_session", lambda: session_video_with_config)
    with pytest.raises(ValueError, match="Remote update failed with status code 403."):
        _ = video_response.sync_remote(
            base_path=sample_data.get_hommerich_pyorc_files(), institute=institute, site=site
        )


@pytest.mark.skipif(
    not os.getenv("LIVEORC_URL") or not os.getenv("LIVEORC_EMAIL") or not os.getenv("LIVEORC_PASSWORD"),
    reason="This test requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set",
)
def test_video_sync_real_server(session_video_with_config, video_response, monkeypatch):
    """Test for syncing a video record to a real remote API.

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
    new_callback_url = models.CallbackUrl(**new_callback_dict)
    crud.callback_url.add(session_video_with_config, new_callback_url)

    # now we have access through the temporary database. Let's perform a post.
    monkeypatch.setattr("orc_api.schemas.base.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.time_series.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.video.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.video_config.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.cross_section.get_session", lambda: session_video_with_config)
    monkeypatch.setattr("orc_api.schemas.recipe.get_session", lambda: session_video_with_config)

    video_update = video_response.sync_remote(base_path=sample_data.get_hommerich_pyorc_files(), site=1, institute=1)
    print(video_update)
