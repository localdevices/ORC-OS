"""System utilities."""

import getpass
import os
import socket
import subprocess
import time
from datetime import datetime
from pathlib import Path


def _detect_timezone_iana(local_now: datetime) -> str:
    """Detect the server's timezone in IANA format (e.g. 'Europe/Amsterdam').

    This is not standard practice for Python applications, but needed for front-end compatibility.
    """
    # first try to get tzinfo from the local_now datetime object, which should be timezone-aware
    tzinfo = local_now.tzinfo

    # try to retrieve from "key"
    key = getattr(tzinfo, "key", None)
    if isinstance(key, str) and "/" in key:
        return key

    # 2) Some tz implementations expose "zone"
    zone = getattr(tzinfo, "zone", None)
    if isinstance(zone, str) and "/" in zone:
        return zone

    # 3) Environment variable (common in containers/systemd)
    tz_env = os.environ.get("TZ")
    if tz_env and "/" in tz_env:
        return tz_env

    # 4) Debian/Ubuntu style
    tz_file = Path("/etc/timezone")
    if tz_file.exists():
        try:
            value = tz_file.read_text().strip()
            if value and "/" in value:
                return value
        except Exception:
            pass

    # 5) /etc/localtime symlink into /usr/share/zoneinfo
    localtime = Path("/etc/localtime")
    try:
        target = localtime.resolve(strict=True)
        parts = target.parts
        if "zoneinfo" in parts:
            idx = parts.index("zoneinfo")
            candidate = "/".join(parts[idx + 1 :])
            if candidate and "/" in candidate:
                return candidate
    except Exception:
        pass

    return "UTC"


def get_hostname() -> str:
    """Get the hostname of the device."""
    try:
        return socket.gethostname()
    except Exception:
        # for linux cases
        return Path("/etc/hostname").read_text().strip()


def get_primary_internal_ip() -> str:
    """Get the primary internal IP address of the device through a test connection."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # dummy connection without packages
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        # if not connected, return the default localhost address
        return "127.0.0.1"
    finally:
        s.close()


def get_user() -> str:
    """Get currently logged in user."""
    return getpass.getuser()


def reboot_after_time(start_time: float, timeout: float):
    """Check and trigger a system reboot if the specified timeout period has elapsed.

    Parameters
    ----------
    start_time: float
        The timestamp representing the start time to monitor for a reboot.
    timeout: float
        The timeout duration in seconds after which a reboot is triggered if the
        condition is met.

    Returns
    -------
    None

    """
    # check if a reboot is required
    if time.time() > start_time + timeout:
        # time to reboot!
        subprocess.run(["sudo", "reboot", "now"])


def get_server_timezone_info():
    """Get server timezone offset in seconds and as a string like '+02:00' or '-03:30'.

    Returns:
        dict: {
            'offset_seconds': int,  # e.g. 7200 for +02:00
            'offset_string': str    # e.g. '+02:00' or '-03:30'
        }

    """
    now = datetime.now()
    local_now = now.astimezone()
    utc_offset = local_now.utcoffset()

    offset_seconds = int(utc_offset.total_seconds())

    # Calculate hours and minutes
    abs_offset = abs(offset_seconds)
    hours = abs_offset // 3600
    minutes = (abs_offset % 3600) // 60

    # Format as +HH:MM or -HH:MM
    sign = "+" if offset_seconds >= 0 else "-"
    offset_string = f"{sign}{hours:02d}:{minutes:02d}"

    return {
        "epoch_seconds": time.time(),
        "offset_seconds": offset_seconds,
        "offset_string": offset_string,
        "timezone": str(local_now.tzinfo),
        "timezone_iana": _detect_timezone_iana(local_now),  # for the front-end
    }
