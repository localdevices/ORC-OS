"""System utilities."""

import getpass
import socket
import subprocess
import time
from pathlib import Path


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
