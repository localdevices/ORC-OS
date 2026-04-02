"""Example release manifest contract for updater preflight checks."""

from __future__ import annotations

import sys

from orc_api import __version__, crud
from orc_api.database import get_session
from orc_api.schemas.callback_url import CallbackUrlResponse

# We define an API version to allow future compatibility checks to conditionally support older manifest formats if
# needed.
MANIFEST_API = "1"

# Fix version numbers below. This must be modified before release in case version numbers should increase.
MIN_ORC_VERSION = (0, 5, 0)
MIN_LIVEORC_VERSION = (0, 3, 0)
MIN_SQLITE_VERSION = (
    3,
    34,
    1,
)  # minimum version available on Bullseye, should be updated to trixie minimum version when we update the base image


def get_checks():
    """Return compatibility checks in execution order.

    Add new tests as these become essential for guaranteeing working versions of ORC-OS after an update.
    """
    # return list of check functions
    return [check_python_version, check_orc_version, check_liveorc_version, check_sqlite_version]


def check_python_version():
    """Verify that local Python runtime satisfies release requirements."""
    min_python = (3, 9)
    if sys.version_info < min_python:
        version_str = f"{sys.version_info.major}.{sys.version_info.minor}"
        return {
            "check_id": "python_version",
            "status": "OUTDATED",
            "message": f"Python {version_str} is too old for this release.",
            "remedy": f"Upgrade Python to {min_python[0]}.{min_python[1]} or newer.",
        }
    return {
        "check_id": "python_version",
        "status": "OK",
        "message": "Python runtime is compatible.",
    }


def check_orc_version():
    """Sometimes, version upgrades may require intermediate updates first.

    This may be relevant in the following cases:
    * serious database migrations
    * modifications in the update process itself (e.g. new backup procedure, new pre/post update hooks, etc.)
      this may require that the new update procedure first is installed, so that later updates can utilize the new
      procedures.
    """
    installed_version = tuple(int(part) for part in __version__.split("."))
    min_supported = MIN_ORC_VERSION
    if installed_version < min_supported:
        return {
            "check_id": "orc_version",
            "status": "OUTDATED",
            "message": f"Installed ORC-OS version {'.'.join(str(v) for v in installed_version)} is too old.",
            "remedy": f"First update to {'.'.join(str(v) for v in min_supported)} before installing this release.",
        }
    return {
        "check_id": "orc_version",
        "status": "OK",
        "message": f"Installed ORC-OS version {'.'.join(str(v) for v in installed_version)} is supported.",
    }


def check_liveorc_version():
    """Check LiveORC version compatibility, only when LiveORC is configured."""
    with get_session() as session:
        callback_url = crud.callback_url.get(session)
    if callback_url is None:
        return {
            "check_id": "liveorc_version",
            "status": "NOT_AVAILABLE",
            "message": "LiveORC version check not applicable since LiveORC is not configured.",
            "remedy": "Assume LiveORC is not required, please ensure that if you configure LiveORC it is at "
            f"least version {'.'.join(str(v) for v in MIN_LIVEORC_VERSION)}.",
        }
    # attempt to retrieve the version from LiveORC. If this fails, we assume the worst case that the version is
    # incompatible, since we cannot verify it.
    try:
        callback_url = CallbackUrlResponse.model_validate(callback_url)
        callback_url_version = callback_url.get_version()
    except Exception as e:
        if e.status_code == 404:
            return {
                "check_id": "liveorc_version",
                "status": "NOT_AVAILABLE",
                "message": f"LiveORC version check not available: {e.detail}",
                "remedy": f"Ensure that LiveORC is running and accessible at the configured callback URL. "
                "You may update, but ensure that LiveORC is at "
                f"least version {'.'.join(str(v) for v in MIN_LIVEORC_VERSION)}.",
            }
        else:
            return {
                "check_id": "liveorc_version",
                "status": "ERROR",
                "message": f"Error retrieving LiveORC version: {e.detail}",
                "remedy": "Ensure that LiveORC is running and accessible at the configured callback URL. ",
            }
    if callback_url_version is None:
        return {
            "check_id": "liveorc_version",
            "status": "NOT_AVAILABLE",
            "message": "LiveORC version check not available: version information could not be retrieved.",
            "remedy": f"Ensure that LiveORC is running and accessible at the configured callback URL. You may "
            f"update, but ensure that LiveORC is at least version {'.'.join(str(v) for v in MIN_LIVEORC_VERSION)}.",
        }
    # split version into tuple
    version = tuple(int(part) for part in callback_url_version.split(".") if part.isdigit())
    if version < MIN_LIVEORC_VERSION:
        return {
            "check_id": "liveorc_version",
            "status": "OUTDATED",
            "message": f"LiveORC version {callback_url_version} at configured URL {callback_url.url} is outdated.",
            "remedy": f"Update LiveORC at {callback_url.url} to at least version "
            f"{'.'.join(str(v) for v in MIN_LIVEORC_VERSION)} before installing this release.",
        }
    return {
        "check_id": "liveorc_version",
        "status": "OK",
        "message": f"LiveORC version {callback_url_version} at callback URL is compatible.",
    }


def check_sqlite_version():
    """Check that the installed SQLite version meets the minimum requirements."""
    import sqlite3

    version_str = sqlite3.sqlite_version
    version = tuple(int(part) for part in version_str.split(".") if part.isdigit())
    if version < MIN_SQLITE_VERSION:
        return {
            "check_id": "sqlite_version",
            "status": "OUTDATED",
            "message": f"SQLite version {version_str} is outdated.",
            "remedy": f"Upgrade SQLite to at least version {'.'.join(str(v) for v in MIN_SQLITE_VERSION)}.",
        }
    return {
        "check_id": "sqlite_version",
        "status": "OK",
        "message": f"SQLite version {version_str} is compatible.",
    }


# Uncomment for testing, replace the function to test specific checks.
if __name__ == "__main__":
    import json

    # select check to test below
    result = check_sqlite_version()
    print(json.dumps(result, indent=2))
