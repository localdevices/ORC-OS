"""Update end points."""

import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

import httpx
import pkg_resources
from fastapi import APIRouter, BackgroundTasks, HTTPException

import orc_api

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


async def download_release_asset(asset_url: str) -> bytes:
    """Download a release asset from GitHub."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            asset_url,
            headers={"Accept": "application/octet-stream"},
            follow_redirects=True,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download release asset")
        return response.content


async def do_update(backup_distribution=False):
    """Perform the update."""
    if update_state.is_updating:
        return {"status": "Update already in progress"}

    update_state.is_updating = True
    update_state.last_status = "Starting update..."
    try:
        # Check for latest release
        # ========================
        version_info = await check_github_version()
        if not version_info["online"]:
            update_state.last_status = "Not online, cannot update"
            return {"status": "Not online, cannot update"}
        if "timeout" in version_info["latest_version"]:
            msg = "Timeout reached while retrieving update. Connection not stable enough for updating."
            update_state.last_status = msg
            return {"status": msg}
        if not version_info["update_available"]:
            update_state.last_status = "No update available"
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
            update_state.last_status = "No frontend build asset found in release"
            raise Exception("Frontend build asset not found in release, cannot update front end.")

        # checks are complete and update seems available and complete

        # Backup current packages setup for rollback purposes
        # ===================================================
        with tempfile.TemporaryDirectory() as backup_dir:
            update_state.last_status = "Backing up package list..."
            # Save current requirements
            requirements = subprocess.run(
                [sys.executable, "-m", "pip", "freeze", "--local"], capture_output=True, text=True
            ).stdout.strip()
            fn_package_backup = os.path.join(backup_dir, "requirements.txt")
            # write reqs to file
            with open(fn_package_backup, "w") as f:
                f.write(requirements)

            if backup_distribution:
                update_state.last_status = "Backing up full distribution, this will take a while..."
                # this is the safest option, ensures that full rollback is possible, does not use reqs.
                package_location = pkg_resources.get_distribution("orc_api").location
                shutil.copytree(package_location, os.path.join(backup_dir, "orc_api_backup"), dirs_exist_ok=True)

            # Create temporary directory for the update
            with tempfile.TemporaryDirectory() as temp_dir:
                update_state.last_status = "Downloading stuff..."

                # Download and extract frontend build
                frontend_content = await download_release_asset(frontend_asset["browser_download_url"])
                frontend_zip = os.path.join(temp_dir, "frontend-build.zip")

                with open(frontend_zip, "wb") as f:
                    f.write(frontend_content)

                # Extract frontend build to temporary directory
                with zipfile.ZipFile(frontend_zip, "r") as zip_ref:
                    zip_ref.extractall(os.path.join(temp_dir, "frontend"))

                update_state.last_status = "Updating back-end stuff..."

                # try except for updating the package
                try:
                    # Install the new version directly from GitHub using pip
                    repo_url = f"git+https://github.com/{repo_owner}/{repo_name}.git@{release_data['tag_name']}"
                    subprocess.run(
                        [sys.executable, "-m", "pip", "install", "--upgrade", "--no-deps", repo_url], check=True
                    )
                    update_state.last_status = "Updating dependencies..."
                    subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", repo_url], check=True)
                except subprocess.CalledProcessError as e:
                    try:
                        if backup_distribution:
                            # remove the current distro
                            shutil.rmtree(package_location, ignore_errors=True)
                            # canonical rename of the whole previous distribution to the previous
                            shutil.move(os.path.join(backup_dir, "orc_api_backup"), package_location)
                        else:
                            # if not copying distributions, try to install previous version from requirements.txt
                            subprocess.run(
                                [sys.executable, "-m", "pip", "install", "-r", fn_package_backup], check=True
                            )
                        raise Exception(
                            f"Failed to update to new version with error: {str(e)}. Rolled back to previous version."
                        )
                    except subprocess.CalledProcessError as rollback_error:
                        raise Exception(
                            f"Update failed, and also rollback failed. System may be inconsistent, please contact "
                            f"your supplier. Error during installation: {str(e)}. Rollback error: {str(rollback_error)}"
                        )

                # Deploy frontend build
                update_state.last_status = "Deploying frontend..."
                www_root = os.path.join(orc_api.__home__, "www")

                # Backup current frontend build
                if os.path.isdir(www_root):
                    www_root_backup = os.path.join(orc_api.__home__, "www_backup")
                    os.makedirs(www_root_backup, exist_ok=True)
                    if os.path.isdir(www_root_backup):
                        shutil.rmtree(www_root_backup)
                    shutil.copytree(www_root, www_root_backup)
                    # remove old distribution
                    shutil.rmtree(www_root)
                try:
                    # Copy new frontend build
                    shutil.copytree(os.path.join(temp_dir, "frontend"), www_root)
                except Exception as e:
                    shutil.move(www_root_backup, www_root)
                    raise Exception(
                        f"Failed to deploy new frontend build with error: {str(e)}. Rolled back to previous version."
                    )
        # close API for restart
        update_state.last_status = "API is restarting. Refresh (Ctrl+R) several times to get reconnected."
        os._exit(0)

    except Exception as e:
        update_state.last_status = f"Update failed: {str(e)}"
        # Log the error here
        raise f"Error occurred during update: {str(e)}"
    finally:
        update_state.is_updating = False


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
