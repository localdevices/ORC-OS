from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi.testclient import TestClient

from orc_api.routers.updates import clear_directory, copy_directory_content, do_update, router

client = TestClient(router)

# Mock environment variables and helper data
MOCK_VERSION_INFO = {
    "online": True,
    "update_available": True,
    "release_data": {
        "assets": [{"name": "frontend-build.zip", "browser_download_url": "http://mock_url", "digest": "mock_digest"}],
        "tag_name": "v1.2.3",
    },
    "latest_version": "v1.2.3",
}


@pytest.fixture
def mock_asyncio_sleep():
    async def async_noop(_):
        pass

    with patch("asyncio.sleep", async_noop):
        yield


@pytest.fixture
def mock_modify_state_update_event():
    with patch("orc_api.routers.updates.modify_state_update_event", new_callable=AsyncMock) as mock_event:
        yield mock_event


@pytest.fixture
def mock_check_github_version():
    with patch("orc_api.routers.updates.check_github_version", new_callable=AsyncMock) as mock_version:
        mock_version.return_value = MOCK_VERSION_INFO
        yield mock_version


@pytest.fixture
def mock_do_update():
    with patch("orc_api.routers.updates.do_update", new_callable=AsyncMock) as mock_update:
        mock_update.return_value = None
        yield mock_update


@pytest.fixture
def mock_download_release_asset():
    with patch("orc_api.routers.updates.download_release_asset", new_callable=AsyncMock) as mock_download:
        mock_download.return_value = b"mock file data"
        yield mock_download


@pytest.fixture
def mock_migrate_dbase():
    with patch("orc_api.routers.updates.migrate_dbase", new_callable=Mock) as mock_migrate:
        yield mock_migrate


@pytest.fixture
def mock_os_exit():
    with patch("os._exit", new_callable=Mock) as mock_exit:
        yield mock_exit


@pytest.fixture
def mock_subprocess_run():
    def mock_run_side_effect(args, **kwargs):
        if "freeze" in args:
            # Simulate the output for `pip freeze`
            return type("CompletedProcess", (), {"stdout": "package1==0.1.0\npackage2==0.2.0"})
        else:
            # Simulate some other output for different commands
            return type("CompletedProcess", (), {"stdout": "Success message"})

    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = mock_run_side_effect
        yield mock_run


@pytest.fixture
def mock_shutil_operations():
    with (
        patch("shutil.copyfile") as mock_copyfile,
        patch("shutil.copytree") as mock_copytree,
        patch("shutil.rmtree") as mock_rmtree,
        patch("orc_api.routers.updates.clear_directory") as mock_clear_directory,
        patch("orc_api.routers.updates.copy_directory_content") as mock_copy_directory_content,
    ):
        yield mock_copyfile, mock_copytree, mock_rmtree, mock_clear_directory, mock_copy_directory_content


@pytest.fixture
def mock_unzip_frontend():
    with patch("orc_api.routers.updates.unzip_frontend", new_callable=AsyncMock) as mock_unzip:
        yield mock_unzip


# Test cases for do_update
@pytest.mark.asyncio
async def test_do_update_error_handling(
    mock_asyncio_sleep,
    mock_check_github_version,
    mock_modify_state_update_event,
    mock_download_release_asset,
    mock_subprocess_run,
):
    # Simulate an error during backend installation
    mock_subprocess_run.side_effect = BaseException("Mocked subprocess error")

    with pytest.raises(BaseException, match="Mocked subprocess error"):
        await do_update()

    mock_check_github_version.assert_called_once()
    # mock_download_release_asset.assert_awaited()
    mock_modify_state_update_event.assert_awaited()


@pytest.mark.asyncio
async def test_do_update_success(
    mock_asyncio_sleep,
    mock_check_github_version,
    mock_modify_state_update_event,
    mock_shutil_operations,
    mock_subprocess_run,
    mock_download_release_asset,
    mock_migrate_dbase,
    mock_unzip_frontend,
    mock_os_exit,
):
    # Mock success for all operations
    (
        mock_shutil_copyfile,
        mock_shutil_copytree,
        mock_shutil_rmtree,
        mock_clear_directory,
        mock_copy_directory_content,
    ) = mock_shutil_operations

    _ = await do_update()

    mock_check_github_version.assert_called_once()
    mock_download_release_asset.assert_awaited()
    mock_modify_state_update_event.assert_awaited()
    mock_subprocess_run.assert_called()
    mock_migrate_dbase.assert_called_once()
    mock_shutil_copyfile.assert_called()
    mock_shutil_copytree.assert_called()
    # mock_clear_directory.assert_called_once()
    # mock_copy_directory_content.assert_called_once()
    # mock_shutil_rmtree.assert_called()
    mock_unzip_frontend.assert_awaited()


@pytest.mark.asyncio
async def test_do_update_no_version(mock_asyncio_sleep, mock_check_github_version, mock_modify_state_update_event):
    # Simulate no new update available
    mock_check_github_version.return_value["update_available"] = False
    response = await do_update()
    assert response["status"] == "No update available"
    mock_check_github_version.assert_called_once()
    mock_modify_state_update_event.assert_awaited()


# Endpoint-specific tests
@pytest.mark.asyncio
async def test_check_updates():
    response = client.get("/updates/check/")
    assert response.status_code == 200
    # check if the tag name starts with "v", compulsory for successful updates procedures
    assert response.json()["release_data"]["tag_name"][0] == "v"


@pytest.mark.asyncio
def test_start_update(mock_modify_state_update_event, mock_do_update):
    response = client.post("/updates/start/")
    assert response.status_code == 200
    assert response.json() == {"status": "Update process started"}


@pytest.mark.asyncio
def test_update_status():
    response = client.get("/updates/status/")
    assert response.status_code == 200
    assert "status" in response.json()


@pytest.mark.asyncio
def test_shutdown_api(mock_os_exit):
    response = client.post("/updates/shutdown/")
    assert response.status_code == 200


def test_clear_directory(tmpdir):
    """Attempt clearing of a tmpdir with a touched file."""
    tmp_file = tmpdir.join("test.txt")
    with open(tmp_file, "w") as f:
        f.write("test")
    # now call clear_directory
    clear_directory(tmpdir)
    # check if directory still exists and if it is empty
    assert tmpdir.exists()
    assert not tmpdir.listdir()


def test_copy_content(tmpdir):
    # first create some dirs
    tmpdir1 = tmpdir.mkdir("dir1")
    tmpdir2 = tmpdir.mkdir("dir2")
    # now write a file in tmpdir1
    tmpfile = tmpdir1.join("test.txt")
    with open(tmpfile, "w") as f:
        f.write("test")
    # now copy content
    copy_directory_content(tmpdir1, tmpdir2)
    # check if the file is copied
    assert tmpdir2.join("test.txt").exists()


# also test the websocket


@pytest.mark.asyncio
async def test_update_status_ws_message_handling():
    with client.websocket_connect("/updates/status_ws") as websocket:

        def mock_status_update():
            return {"is_updating": True, "status": "In Progress"}

        # Simulate sending a message to the client
        status_message = mock_status_update()
        websocket.send_json(status_message)


@pytest.mark.asyncio
async def test_update_status_ws_disconnect_handling():
    """Check if client gracefully disconnects."""
    with client.websocket_connect("/updates/status_ws") as websocket:
        websocket.close(code=1001)
