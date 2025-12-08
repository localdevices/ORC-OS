"""System utilities."""

import subprocess
import time


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
