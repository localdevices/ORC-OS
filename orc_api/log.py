"""Logging utilities."""

import asyncio
import logging
import logging.handlers
import os
import sys
from datetime import datetime

from fastapi import WebSocket

from orc_api import LOG_DIRECTORY, __home__, __version__

timestr = datetime.now().strftime("%Y%m%dT%H%M%S")
datestr = datetime.now().strftime("%Y%m%d")
FMT = "%(asctime)s - %(name)s - %(module)s - %(levelname)s - %(message)s"


def setuplog(
    name: str = "orc-os",
    path: str = None,
    log_level: int = 20,
    fmt: str = FMT,
    append: bool = True,
) -> logging.Logger:
    """Set up the logging on sys.stdout and file if path is given.

    Parameters
    ----------
    name : str, optional
        logger name, by default "hydromt"
    path : str, optional
        path to logfile, by default None
    log_level : int, optional
        Log level [0-50], by default 20 (info)
    fmt : str, optional
        log message formatter, by default {FMT}
    append : bool, optional
        Whether to append (True) or overwrite (False) to a logfile at path, by default True

    Returns
    -------
    logging.Logger
        _description_

    """
    logger = logging.getLogger(name)
    for _ in range(len(logger.handlers)):
        logger.handlers.pop().close()  # remove and close existing handlers
    logging.captureWarnings(True)
    logger.setLevel(log_level)
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(log_level)
    console.setFormatter(logging.Formatter(fmt))
    logger.addHandler(console)
    if path is not None:
        if append is False and os.path.isfile(path):
            os.unlink(path)
        add_filehandler(logger, path, log_level=log_level, fmt=fmt)
    logger.info(f"ORC-OS version: {__version__}")

    return logger


def add_filehandler(logger, path, log_level=20, fmt=FMT):
    """Add file handler to logger."""
    if not os.path.isdir(os.path.dirname(path)):
        print(path)
        os.makedirs(os.path.dirname(path))
    isfile = os.path.isfile(path)
    ch = logging.FileHandler(path)
    ch.setFormatter(logging.Formatter(fmt))
    ch.setLevel(log_level)
    logger.addHandler(ch)
    if isfile:
        logger.debug(f"Appending log messages to file {path}.")
    else:
        logger.debug(f"Writing log messages to new file {path}.")


def start_logger(verbose, quiet, log_path=None):
    if not log_path:
        # set it here to a fixed location
        log_path = os.path.join(__home__, "log")
    if verbose:
        verbose = 2
    else:
        verbose = 1
    if quiet:
        quiet = 1
    else:
        quiet = 0
    logfile = os.path.abspath(os.path.join(log_path, datestr, f"orc-os-{timestr}.log"))
    log_level = max(10, 30 - 10 * (verbose - quiet))
    logger = setuplog(name="ORC-OS", path=logfile, log_level=log_level)
    return logger


def get_last_lines(fn: str, count: int = 10):
    """Get the last `count` lines from a file."""
    if not os.path.exists(fn):
        raise FileNotFoundError(f"Log file not found: {fn}")

    with open(fn, "rb") as f:
        f.seek(0, os.SEEK_END)  # Move to the end of the file
        buffer = bytearray()
        lines_found = 0
        # Start reading backward
        while f.tell() > 0 and lines_found <= count:
            f.seek(-1, os.SEEK_CUR)  # Step back one character
            byte = f.read(1)  # Read one character
            if byte == b"\n":  # Check for new line
                lines_found += 1
                if lines_found > count:
                    break
            buffer.extend(byte)
            f.seek(-1, os.SEEK_CUR)  # Step back again to continue
    return buffer[::-1].decode("utf-8")  # Reverse the buffer to get the correct order


async def stream_new_lines(websocket: WebSocket, fn: str):
    """Stream new lines from a file as they are written."""
    with open(fn, "r") as f:
        # Move to the end of the file
        f.seek(0, 2)
        while True:
            line = f.readline()
            if line:
                await websocket.send_text(line)  # Send the new line to the WebSocket
            else:
                await asyncio.sleep(0.1)  # Wait before trying to read more lines


if "ALEMBIC_RUNNING" not in os.environ:
    logger = start_logger(True, False, log_path=LOG_DIRECTORY)
else:
    logger = None

__all__ = ["logger", "get_last_lines", "stream_new_lines"]
