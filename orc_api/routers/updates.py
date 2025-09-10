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
from typing import List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket
from starlette.websockets import WebSocketDisconnect

import orc_api
from alembic import command
from alembic.config import Config

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


async def check_github_version():
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
        # Run Alembic migrations
        alembic_cfg = Config(config_location)
        alembic_cfg.set_main_option("script_location", script_location)
        alembic_cfg.set_main_option("sqlalchemy.url", db_engine)

        # await modify_state_update_event(True, "Applying database migrations...")
        command.upgrade(alembic_cfg, "head")
    except Exception as migration_error:
        raise Exception(f"Database migration failed and was rolled back. Error: {migration_error}")
        # database restore will be done elsewhere


async def do_update(backup_distribution=False):
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
    db_engine = orc_api.db.sqlite_engine
    api_update_success = False  # start with false, if successful, will be set to true
    update_success = True  # will be made False during exception

    if update_state.is_updating:
        return {"status": "Update already in progress"}
    await asyncio.sleep(1)
    await modify_state_update_event(True, "Starting update...")
    try:
        # Check for latest release
        # ========================
        version_info = await check_github_version()
        if not version_info["online"]:
            await asyncio.sleep(1)
            await modify_state_update_event(True, "Not online, cannot update")
            return {"status": "Not online, cannot update"}
        if "timeout" in version_info["latest_version"]:
            msg = "Timeout reached while retrieving update. Connection not stable enough for updating."
            await asyncio.sleep(1)
            await modify_state_update_event(True, msg)
            return {"status": msg}
        if not version_info["update_available"]:
            await asyncio.sleep(1)
            await modify_state_update_event(True, "No update available")
            return {"status": "No update available"}

        if "error" in version_info:
            raise Exception("Failed to get release information")

        release_data = version_info["release_data"]

        # Find the frontend build asset (assuming it's named 'frontend-build.zip')
        frontend_asset = next(
            (asset for asset in release_data["assets"] if asset["name"] == "frontend-build.zip"), None
        )

        if not frontend_asset:
            # finalize state and raise
            await modify_state_update_event(True, "No frontend build asset found in release")
            raise Exception("Frontend build asset not found in release, cannot update front end. Contact support.")

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
            backup_db_path = os.path.join(backup_dir, "orc_api_backup.db")
            shutil.copyfile(db_path, backup_db_path)

            # Create another temporary directory for the update
            with tempfile.TemporaryDirectory() as temp_dir:
                await asyncio.sleep(1)
                await modify_state_update_event(True, "Downloading and extracting ORC front end...")

                # Download and extract frontend build
                frontend_content = await download_release_asset(
                    frontend_asset["browser_download_url"],
                    expected_sha256=frontend_asset["digest"].removeprefix("sha256:"),
                )
                await unzip_frontend(frontend_content, temp_dir)
                await asyncio.sleep(1)
                await modify_state_update_event(True, "Updating back-end stuff...")
                # try except for updating the package
                try:
                    # Install the new version directly from GitHub using pip
                    await asyncio.sleep(1)
                    await modify_state_update_event(True, f"Preparing new backend {release_data['tag_name']}...")
                    repo_url = f"git+https://github.com/{repo_owner}/{repo_name}.git@{release_data['tag_name']}"
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
        raise f"Error occurred during update: {str(e)}"
    finally:
        if update_success:
            await asyncio.sleep(5)
            await modify_state_update_event(False)


@router.get("/check")
async def check_updates():
    """Check for updates."""
    return await check_github_version()


@router.post("/start")
async def start_update(background_tasks: BackgroundTasks):
    """Start the update process."""
    background_tasks.add_task(do_update)
    return {"status": "Update process started"}


@router.get("/status")
async def update_status():
    """Get the current status of the update process."""
    return {"is_updating": update_state.is_updating, "status": update_state.last_status}


@router.post("/shutdown")
async def shutdown_api():
    """Stop or restart the API by shutting it down. The restart must be orchestrated by a systemd or Docker process."""
    os._exit(0)


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
        update_state.last_status = last_status
    # notify change after a short time, to avoid hrottling
    await state_update_queue.put({"is_updating": update_state.is_updating, "status": update_state.last_status})
