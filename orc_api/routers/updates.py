"""Update end points."""

import asyncio
import hashlib
import importlib.metadata
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from typing import Any, List, Optional

import httpx
from alembic import command
from alembic.config import Config
from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket
from starlette.websockets import WebSocketDisconnect

import orc_api
from orc_api.log import logger
from orc_api.manifest.perform_checks import run_manifest_checks_from_source
from orc_api.schemas.updates import (
    CheckStatus,
    ManifestCheckResult,
    ManifestPreflightResult,
    ReleaseItem,
    ReleaseListResponse,
    VersionedPreflightResponse,
)

router = APIRouter(prefix="/updates", tags=["updates"])


class UpdateInfo:
    """State information for updating."""

    def __init__(self):
        """Initialize the state."""
        self.is_updating = False
        self.last_status = "No update in progress"


update_state = UpdateInfo()
repo_owner = "localdevices"
repo_name = "ORC-OS"
service_name = "ORC-API.service"

websocket_conns: List[WebSocket] = []

# Event used to notify state changes
state_update_queue = asyncio.Queue()


def _asset_digest(asset: dict) -> str:
    """Extract sha256 digest value from release asset metadata."""
    digest = asset.get("digest", "")
    if not digest:
        raise HTTPException(status_code=500, detail=f"Release asset '{asset.get('name', 'unknown')}' has no digest")
    return digest.removeprefix("sha256:")


async def _release_asset_by_name(release_data: dict, asset_name: str) -> dict:
    """Return a release asset by exact name or raise."""
    asset = next((item for item in release_data.get("assets", []) if item.get("name") == asset_name), None)
    if asset is None:
        raise HTTPException(status_code=500, detail=f"Release asset '{asset_name}' not found")
    return asset


async def fetch_release_by_tag(tag_name: str) -> dict[str, Any]:
    """Fetch release data from GitHub by tag name."""
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://api.github.com/repos/{repo_owner}/{repo_name}/releases/tags/{tag_name}",
            timeout=httpx.Timeout(connect=3.0, read=8.0, write=5.0, pool=5.0),
        )
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Release tag '{tag_name}' not found")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch release by tag")
        return r.json()


async def fetch_github_releases() -> list[dict[str, Any]]:
    """Fetch all available releases from GitHub, newest first."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{repo_owner}/{repo_name}/releases",
            timeout=httpx.Timeout(connect=3.0, read=8.0, write=5.0, pool=5.0),
        )

    if response.status_code == 200:
        payload = response.json()
        if isinstance(payload, list):
            return payload
        raise HTTPException(status_code=502, detail="Unexpected GitHub releases response format")

    if response.status_code == 403:
        try:
            message = response.json().get("message", "GitHub API rate limit or permission issue")
        except Exception as e:
            message = f"GitHub API rate limit or permission issue: {e}"
        raise HTTPException(status_code=403, detail=message)
    raise HTTPException(status_code=502, detail="Failed to fetch releases from GitHub")


async def run_release_preflight(release_data: dict[str, Any]) -> ManifestPreflightResult:
    """Download and execute release manifest checks before updating."""
    try:
        manifest_asset = _release_asset_by_name(release_data, "manifest.py")
    # catch 500 errors containing "not found" in its detail. These must be handled with assumed no blockages in updates
    except HTTPException as e:
        if e.status_code == 500 and "not found" in str(e.detail).lower():
            return ManifestPreflightResult(
                ok_to_update=True,
                blocking_statuses=[],
                results=[
                    ManifestCheckResult(
                        check_id="manifest_presence",
                        status=CheckStatus.NOT_AVAILABLE,
                        message="No release manifest found, skipping compatibility checks.",
                        remedy=None,
                    )
                ],
            )
        raise e

    manifest_content = await download_release_asset(
        manifest_asset["browser_download_url"],
        expected_sha256=_asset_digest(manifest_asset),
    )
    source_code = manifest_content.decode("utf-8")
    return await run_manifest_checks_from_source(source_code=source_code, timeout_s=10.0)


# def _ensure_release_data(value: Any) -> dict[str, Any]:
#     """Validate release data shape from remote response."""
#     if isinstance(value, dict):
#         return value
#     raise HTTPException(status_code=500, detail="Invalid release data format")


def clear_directory(path):
    """Clear content in path."""
    for filename in os.listdir(path):
        file_path = os.path.join(path, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f"Failed to delete {file_path}: {e}")


def copy_directory_content(src, dst):
    """Copy only content within src folder to dst while preserving dst root folder item."""
    # Copy new files into existing folder
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)


async def check_latest_github_version():
    """Check the remote latest version of the API from GitHub.

    Returns a dictionary with current version, latest version, update available and raw JSON release data from response.
    """
    current_version = orc_api.__version__
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{repo_owner}/{repo_name}/releases/latest",
                timeout=httpx.Timeout(connect=3.0, read=5.0, write=5.0, pool=5.0),
            )
            if response.status_code == 200:
                release_data = response.json()
                latest_version = release_data["tag_name"].lstrip("v")  # remove v-prefix
                return {
                    "current_version": current_version,
                    "latest_version": latest_version,
                    "update_available": latest_version > current_version,
                    "online": True,
                    "release_data": release_data,
                }
            if response.status_code == 403:
                return {"error": response.json()["message"]}
            return {"error": "Failed to check for updates"}
    except httpx.TimeoutException:
        return {
            "current_version": current_version,
            "latest_version": "N/A timeout",
            "update_available": False,
            "online": True,
            "release_data": None,
        }
    except httpx.ConnectError:
        return {
            "current_version": current_version,
            "latest_version": None,
            "update_available": False,
            "online": False,
            "release_data": None,
        }


async def download_release_asset(asset_url: str, expected_sha256) -> bytes:
    """Download a release asset from GitHub."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            asset_url,
            headers={"Accept": "application/octet-stream"},
            follow_redirects=True,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download release asset")
        if hashlib.sha256(response.content).hexdigest() != expected_sha256:
            raise HTTPException(
                status_code=500,
                detail="SHA256 checksum does not match. Something is wrong with the downloaded file, "
                "please try again later.",
            )
        return response.content


async def unzip_frontend(content: bytes, temp_dir: str):
    """Parse bytes to zip file and unzip that to temporary dir."""
    frontend_zip = os.path.join(temp_dir, "frontend-build.zip")
    with open(frontend_zip, "wb") as f:
        f.write(content)

    # Extract frontend build to temporary directory
    with zipfile.ZipFile(frontend_zip, "r") as zip_ref:
        zip_ref.extractall(os.path.join(temp_dir, "frontend"))
    return


def migrate_dbase(config_location, script_location, db_engine):
    """Migrate the database."""
    try:
        logger.info("Starting database migration...")
        # Run Alembic migrations
        alembic_cfg = Config(config_location)
        alembic_cfg.set_main_option("script_location", script_location)
        alembic_cfg.set_main_option("sqlalchemy.url", db_engine)

        # await modify_state_update_event(True, "Applying database migrations...")
        command.upgrade(alembic_cfg, "head")
    except Exception as migration_error:
        raise Exception(f"Database migration failed and was rolled back. Error: {migration_error}")
        # database restore will be done elsewhere
    finally:
        logger.info("Database migration process completed.")


async def do_update(tag_name, backup_distribution=False):
    """Perform the update."""

    async def _rollback_backend(e):
        # if back-end installation fails, rollback to previous version AND ensure the database is also
        # replaced
        try:
            if backup_distribution:
                # remove the current distro
                shutil.rmtree(package_dir, ignore_errors=True)
                # canonical rename of the whole previous distribution to the previous
                shutil.move(os.path.join(backup_dir, "orc_api_backup"), package_dir)
            else:
                # if not copying distributions, try to install previous version from requirements.txt
                try:
                    subprocess.run([sys.executable, "-m", "pip", "install", "-r", fn_package_backup], check=True)
                except subprocess.CalledProcessError:
                    # desperate try with only local-index, if this fails the system may become unusable.
                    subprocess.run(
                        [sys.executable, "-m", "pip", "install", "--no-index", "-r", fn_package_backup], check=True
                    )

            # copy back the database
            shutil.copyfile(backup_db_path, db_path)
            raise Exception(f"Failed to update to new version with error: {str(e)}. Rolled back to previous version.")

        except subprocess.CalledProcessError as rollback_error:
            raise Exception(
                f"Update failed, and also rollback failed. System may be inconsistent, please contact "
                f"your supplier. Error during installation: {str(e)}. Rollback error: {str(rollback_error)}"
            )

    # collect path info
    base_dir = os.path.split(orc_api.__file__)[0]
    package_dir = str(importlib.metadata.distribution("orc_api").locate_file(""))
    db_path = orc_api.db.db_path_config
    # make sure the backup of the database is side-by-side with the original so that in case of failure it can be
    # easily moved back.
    backup_db_path = os.path.join(os.path.split(db_path)[0], "orc_api_backup.db")
    db_engine = orc_api.db.sqlite_engine
    api_update_success = False  # start with false, if successful, will be set to true
    update_success = True  # will be made False during exception

    if update_state.is_updating:
        return {"status": "Update already in progress"}
    await asyncio.sleep(1)
    await modify_state_update_event(True, "Starting update...")
    try:
        # # Check for latest release
        # # ========================
        # version_info = await check_latest_github_version()
        # if not version_info["online"]:
        #     await asyncio.sleep(1)
        #     await modify_state_update_event(True, "Not online, cannot update")
        #     return {"status": "Not online, cannot update"}
        # if "timeout" in version_info["latest_version"]:
        #     msg = "Timeout reached while retrieving update. Connection not stable enough for updating."
        #     await asyncio.sleep(1)
        #     await modify_state_update_event(True, msg)
        #     return {"status": msg}
        # if not version_info["update_available"]:
        #     await asyncio.sleep(1)
        #     await modify_state_update_event(True, "No update available")
        #     return {"status": "No update available"}

        # if "error" in version_info:
        #     raise Exception("Failed to get release information")

        # release_data = _ensure_release_data(version_info.get("release_data"))
        # tag_name = str(release_data.get("tag_name", ""))
        # if not tag_name:
        #     raise HTTPException(status_code=500, detail="Release tag is missing")

        # Run release-specific compatibility checks before any installation work.
        await asyncio.sleep(1)
        release_data = await fetch_release_by_tag(tag_name)
        await modify_state_update_event(True, "Running compatibility checks...")
        preflight_result = await run_release_preflight(release_data)
        if not preflight_result.ok_to_update:
            failed = [
                f"{result.check_id}: {result.message}"
                for result in preflight_result.results
                if result.status != CheckStatus.OK
            ]
            msg = "Update blocked by compatibility checks: " + " | ".join(failed)
            await modify_state_update_event(True, msg)
            return {"status": msg, "preflight": preflight_result.model_dump()}

        # Find the frontend build asset (assuming it's named 'frontend-build.zip')
        frontend_asset = _release_asset_by_name(release_data, "frontend-build.zip")

        # Checks are complete and update seems available and complete

        with tempfile.TemporaryDirectory() as backup_dir:
            # Backup current packages setup and database for rollback purposes to `backup_dir`
            # ================================================================================
            await asyncio.sleep(1)
            await modify_state_update_event(True, "Backing up package list...")
            # Save current requirements
            requirements = subprocess.run(
                [sys.executable, "-m", "pip", "freeze", "--local"], capture_output=True, text=True
            ).stdout.strip()
            # remove any local file-based libs
            filtered_lines = [line for line in requirements.splitlines() if "file:///" not in line]
            requirements = "\n".join(filtered_lines)
            fn_package_backup = os.path.join(backup_dir, "requirements.txt")
            # write reqs to file
            with open(fn_package_backup, "w") as f:
                f.write(requirements)

            if backup_distribution:
                await asyncio.sleep(1)
                await modify_state_update_event(True, "Backing up full distribution...")
                # this is the safest option, ensures that full rollback is possible, does not use reqs.
                shutil.copytree(package_dir, os.path.join(backup_dir, "orc_api_backup"), dirs_exist_ok=True)

            # backup the database before migration
            time.sleep(1)
            await modify_state_update_event(True, "Backing up database...")
            # copy database side-by-side with original for easier rollback
            shutil.copyfile(db_path, backup_db_path)

            # Create another temporary directory for the update
            with tempfile.TemporaryDirectory() as temp_dir:
                await asyncio.sleep(1)
                await modify_state_update_event(True, "Downloading and extracting ORC front end...")

                # Download and extract frontend build
                frontend_content = await download_release_asset(
                    frontend_asset["browser_download_url"],
                    expected_sha256=_asset_digest(frontend_asset),
                )
                await unzip_frontend(frontend_content, temp_dir)
                await asyncio.sleep(1)
                await modify_state_update_event(True, "Updating back-end stuff...")
                # try except for updating the package
                try:
                    # Install the new version directly from GitHub using pip
                    await asyncio.sleep(1)
                    await modify_state_update_event(True, f"Preparing new backend {tag_name}...")
                    repo_url = f"git+https://github.com/{repo_owner}/{repo_name}.git@{tag_name}"
                    subprocess.run(
                        [
                            sys.executable,
                            "-m",
                            "pip",
                            "install",
                            "--upgrade",
                            "--no-deps",
                            "--target",
                            os.path.join(temp_dir, "orc-os-update"),
                            repo_url,
                        ],
                        check=True,
                    )
                    await modify_state_update_event(True, "Updating dependencies...")
                    await asyncio.sleep(1)
                    subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", repo_url], check=True)
                    # perform database migrations from the temporary install location of the orc api
                    script_location = os.path.join(temp_dir, "orc-os-update", "orc_api", "alembic")
                    config_location = os.path.join(temp_dir, "orc-os-update", "orc_api", "alembic.ini")
                    migrate_dbase(config_location, script_location, db_engine)
                    # only when everything is successful, set the update flag to true
                    api_update_success = True

                except subprocess.CalledProcessError as e:
                    await asyncio.sleep(1)
                    await modify_state_update_event(
                        True, f"Problem occurred during updating back-end: {str(e)}, rolling back..."
                    )
                    await _rollback_backend(e)

                if api_update_success:
                    www_root = None
                    www_root_backup = None
                    try:
                        # Deploy frontend build
                        await asyncio.sleep(1)
                        await modify_state_update_event(True, "Deploying frontend...")
                        # await asyncio.sleep(1)
                        www_root = os.path.join(orc_api.__home__, "www")

                        # Backup current frontend build
                        if os.path.isdir(www_root):
                            www_root_backup = os.path.join(orc_api.__home__, "www_backup")
                            os.makedirs(www_root_backup, exist_ok=True)
                            if os.path.isdir(www_root_backup):
                                shutil.rmtree(www_root_backup)
                            shutil.copytree(www_root, www_root_backup)
                            # remove files and folders inside www_root
                            clear_directory(www_root)
                            copy_directory_content(os.path.join(temp_dir, "frontend"), www_root)
                        else:
                            # this normally should not happen as directory ownership and rights are carefully managed
                            shutil.copytree(os.path.join(temp_dir, "frontend"), www_root)
                    except Exception as e:
                        await modify_state_update_event(
                            True, f"Problem occurred during updating front-end: {str(e)}, rolling back..."
                        )
                        if www_root_backup and www_root:
                            shutil.move(www_root_backup, www_root)
                        # when this happens, also rollback the back-end
                        await _rollback_backend(e)
                # Everything complete, we can now move the temporary ORC API install to its final destination,
                # this is the most risky part, so MUST happen at the latest latest stage.
                shutil.rmtree(base_dir)
                shutil.copytree(os.path.join(temp_dir, "orc-os-update", "orc_api"), base_dir)
            # close API for restart
            await asyncio.sleep(1)
            for secs in range(5, -1, -1):
                await modify_state_update_event(
                    True, f"API is restarting. You will be redirected to the home page in {secs} seconds."
                )
                await asyncio.sleep(1)
            await modify_state_update_event(False, "Update completed")
            await asyncio.sleep(1)
            # at the very final stage, move the new lib in place
        # one more second sleep before restarting
        await asyncio.sleep(1)
        os._exit(0)

    except Exception as e:
        await asyncio.sleep(1)
        await modify_state_update_event(True, f"Update failed: {str(e)}. Refresh page (Ctrl+R)  to continue...")
        # Log the error here
        update_success = False
        raise RuntimeError(f"Error occurred during update: {str(e)}")
    finally:
        if update_success:
            await asyncio.sleep(5)
            await modify_state_update_event(False)


@router.get("/check/")
async def check_updates():
    """Check for updates."""
    return await check_latest_github_version()


@router.get("/releases/", response_model=ReleaseListResponse)
async def list_releases(include_prerelease: bool = False, limit: int = 20):
    """Return available release tags from GitHub."""
    releases_raw = await fetch_github_releases()

    releases: list[ReleaseItem] = []
    for rel in releases_raw:
        if rel.get("draft", False):
            continue
        if not include_prerelease and rel.get("prerelease", False):
            continue

        tag_name = rel.get("tag_name")
        if not tag_name:
            continue

        releases.append(
            ReleaseItem(
                tag_name=str(tag_name),
                published_at=rel.get("published_at"),
                prerelease=bool(rel.get("prerelease", False)),
            )
        )

    safe_limit = max(1, min(limit, 100))
    return ReleaseListResponse(releases=releases[:safe_limit])


@router.get("/releases/{tag_name}/", response_model=dict[str, Any])
async def get_release_by_tag(tag_name: str):
    """Return release details for a specific tag."""
    try:
        release_data = await fetch_release_by_tag(tag_name)
        return release_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot fetch release tag '{tag_name}': {str(e)}")


@router.get("/preflight/{tag_name}/", response_model=VersionedPreflightResponse)
async def preflight_for_tag(tag_name: str):
    """Run all preflight checks for a specific release tag."""
    try:
        release_data = await fetch_release_by_tag(tag_name)
    except HTTPException as http_exc:
        if http_exc.status_code == 500:
            # apparently a server error occurred, if detauils contain "not found", we can assume the tag was not found,
            # otherwise it's a server error
            detail = http_exc.detail
            if isinstance(detail, str) and "not found" in detail.lower():
                raise HTTPException(status_code=404, detail=f"Release tag '{tag_name}' not found")
            else:
                # default to the existing exception, which is a 500 with the original error message
                raise http_exc
    try:
        preflight_result = await run_release_preflight(release_data)
        payload = preflight_result.model_dump()
        payload["tag_name"] = tag_name
        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run preflight checks for the release: {e}")


@router.post("/start/{tag_name}/")
async def start_update(tag_name: str, background_tasks: BackgroundTasks):
    """Start the update process."""
    background_tasks.add_task(do_update, tag_name)
    return {"status": "Update process started"}


@router.get("/status/")
async def update_status():
    """Get the current status of the update process."""
    return {"is_updating": update_state.is_updating, "status": update_state.last_status}


@router.post("/shutdown/")
async def shutdown_api():
    """Stop or restart the API by shutting it down. The restart must be orchestrated by a systemd or Docker process."""
    os._exit(0)


@router.post("/reboot")
async def reboot_device():
    """Reboot the device."""
    subprocess.run(["sudo", "reboot", "now"], check=True)


@router.post("/shutdown_device")
async def shutdown_device():
    """Shutdown the device."""
    subprocess.run(["sudo", "shutdown", "now"], check=True)


@router.websocket("/status_ws")
async def update_status_ws(websocket: WebSocket):
    """Get continuous status of the update process via websocket."""
    await websocket.accept()
    websocket_conns.append(websocket)
    # # send the first message
    # status_msg = {"is_updating": update_state.is_updating, "status": update_state.last_status}
    # await websocket.send_json(status_msg)

    try:
        while True:
            # then just wait until the message changes
            status_msg = await state_update_queue.get()

            await websocket.send_json(status_msg)
            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        print("WebSocket disconnected")
        if websocket in websocket_conns:
            websocket_conns.remove(websocket)

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket in websocket_conns:
            websocket_conns.remove(websocket)
        await websocket.close()


async def modify_state_update_event(is_updating: bool, last_status: Optional[str] = None):
    """Change state handler and notify websocket."""
    update_state.is_updating = is_updating
    if last_status is not None:
        logger.info(last_status)
        update_state.last_status = last_status
    # notify change after a short time, to avoid hrottling
    await state_update_queue.put({"is_updating": update_state.is_updating, "status": update_state.last_status})
