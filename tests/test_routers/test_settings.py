from orc_api import crud
from orc_api.database import get_db
from orc_api.main import app

# fields the dashboard sent before sync_netcdf and sync_log existed
OLD_CLIENT_SETTINGS = {
    "video_file_fmt": "video_{%Y%m%dT%H%M%S}.mp4",
    "allowed_dt": 3600,
    "shutdown_after_task": False,
    "parse_dates_from_file": True,
    "reboot_after": 0,
    "video_config_id": None,
    "sync_file": True,
    "sync_image": True,
    "active": False,
}


def test_post_settings_without_new_sync_flags(auth_client):
    # first post creates the record, second one updates it; neither carries sync_netcdf / sync_log
    for _ in range(2):
        response = auth_client.post("/api/settings/", json=OLD_CLIENT_SETTINGS)
        assert response.status_code == 201, response.text
    settings = crud.settings.get(next(app.dependency_overrides[get_db]()))
    assert settings.sync_netcdf is False
    assert settings.sync_log is False
