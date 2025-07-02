import os
from datetime import datetime

import pytest
from pyorc import CameraConfig as pyorcCameraConfig
from pyorc import CrossSection as pyorcCrossSection
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db import CallbackUrl, CameraConfig, CrossSection, SyncStatus
from orc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse
from orc_api.schemas.camera_config import CameraConfigResponse
from orc_api.schemas.cross_section import CrossSectionResponse, CrossSectionResponseCameraConfig


@pytest.fixture
def cross_section_response(session_cross_section: Session):
    # retrieve cross section
    cs_rec = session_cross_section.query(CrossSection).first()
    return CrossSectionResponse.model_validate(cs_rec)


@pytest.fixture
def camera_config(session_cam_config: Session):
    cam_config_rec = session_cam_config.query(CameraConfig).first()
    return CameraConfigResponse.model_validate(cam_config_rec)


def test_cross_section_schema(cross_section_response):
    # check if crs is available
    assert cross_section_response.crs is not None


def test_cross_section_schema_camera_config(cross_section_response, camera_config):
    cs_with_cam_config = CrossSectionResponseCameraConfig(
        id=cross_section_response.id,
        name=cross_section_response.name,
        features=cross_section_response.features,
        camera_config=camera_config,
    )
    assert cs_with_cam_config.camera_config is not None
    # set up a cross section instance and do some tests
    camera_config = pyorcCameraConfig(**cs_with_cam_config.camera_config.data.model_dump())
    cs = pyorcCrossSection(camera_config=camera_config, cross_section=cs_with_cam_config.gdf)

    # # check if cross section is visible within the image objective
    # pix = cs.camera_config.project_points(
    #     np.array(list(map(list, cs.cs_linestring.coords))) + 4, within_image=True, swap_y_coords=True
    # )
    # # check which points fall within the image objective
    # within_image = np.all([pix[:, 0] >= 0, pix[:, 0] < 1920, pix[:, 1] >= 0, pix[:, 1] < 1080], axis=0)
    # # check if there are any points within the image objective
    # assert np.any(within_image)
    assert cs.within_image
    assert cs.distance_camera < 10
    assert isinstance(cs_with_cam_config.bottom_surface, list)
    assert len(cs_with_cam_config.bottom_surface) > 0


def test_cross_section_sync(session_cross_section, cross_section_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None, timeout=None):
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
    cross_section_update = cross_section_response.sync_remote(session=session_cross_section, site=site)
    assert cross_section_update.remote_id == 3
    assert cross_section_update.sync_status == SyncStatus.SYNCED


def test_cross_section_sync_not_permitted(session_cross_section, cross_section_response, monkeypatch):
    """Test for syncing a cross-section to remote API (real response is mocked)."""
    # let's assume we are posting on site 1
    site = 1

    def mock_post(self, endpoint: str, data=None, json=None, files=None, timeout=None):
        class MockResponse:
            status_code = 403

        return MockResponse()

    monkeypatch.setattr(CallbackUrlResponse, "post", mock_post)
    with pytest.raises(ValueError, match="Remote update failed with status code 403."):
        _ = cross_section_response.sync_remote(session=session_cross_section, site=site)


@pytest.mark.skipif(
    not os.getenv("LIVEORC_URL") or not os.getenv("LIVEORC_EMAIL") or not os.getenv("LIVEORC_PASSWORD"),
    reason="This test requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set",
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

    cross_section_update = cross_section_response.sync_remote(session=session_cross_section, site=1)
    print(cross_section_update)
