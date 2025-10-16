"""Logging utilities."""

import asyncio
import logging
import logging.handlers
import os
import sys

import anyio
from fastapi import WebSocket

from orc_api import LOG_DIRECTORY, __home__, __version__

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
        # if append is False and os.path.isfile(path):
        #     os.unlink(path)
        add_filehandler(logger, path, log_level=log_level, fmt=fmt, backupCount=10)
    logger.info(f"ORC-OS version: {__version__}")

    return logger


def add_filehandler(logger, path, log_level=20, fmt=FMT, backupCount=0):
    """Add file handler to logger."""
    if not os.path.isdir(os.path.dirname(path)):
        os.makedirs(os.path.dirname(path))
    if backupCount > 0:
        ch = logging.handlers.RotatingFileHandler(path, backupCount=backupCount, encoding="utf-8")
        # Force a rollover to create a new log file on application startup
        ch.doRollover()

    else:
        if os.path.isfile(path):
            os.unlink(path)
        ch = logging.FileHandler(path, encoding="utf-8")
    ch.setFormatter(logging.Formatter(fmt))
    ch.setLevel(log_level)
    logger.addHandler(ch)


def remove_file_handler(logger, name_contains="hello_world"):
    """Remove file handler with name_contains in file name from logger."""
    for handler in logger.handlers:
        if isinstance(handler, logging.FileHandler):
            if name_contains in handler.baseFilename:
                logger.removeHandler(handler)
                handler.close()
                logger.debug(f"Removed file handler to {handler.baseFilename} from logger.")


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
    logfile = os.path.abspath(os.path.join(log_path, "orc-os.log"))
    log_level = max(10, 30 - 10 * (verbose - quiet))
    logger = setuplog(name="ORC-OS", path=logfile, log_level=log_level)
    return logger


def get_last_lines(fn: str, count: int = 10):
    """Get the last `count` lines from a file."""
    if not os.path.exists(fn):
        raise FileNotFoundError(f"Log file not found: {fn}")

    # ensure count is limited
    restricted_count = min(count, 500)
    with open(fn, "rb") as f:
        f.seek(0, os.SEEK_END)  # Move to the end of the file
        buffer = bytearray()
        lines_found = 0
        # Start reading backward
        while f.tell() > 0 and lines_found <= restricted_count:
            f.seek(-1, os.SEEK_CUR)  # Step back one character
            byte = f.read(1)  # Read one character
            if byte == b"\n":  # Check for new line
                lines_found += 1
                if lines_found > restricted_count:
                    break
            buffer.extend(byte)
            f.seek(-1, os.SEEK_CUR)  # Step back again to continue
    return buffer[::-1].decode("utf-8")  # Reverse the buffer to get the correct order


async def stream_new_lines(websocket: WebSocket, fn: str):
    """Stream new lines from a file as they are written."""
    if not os.path.exists(fn):
        raise FileNotFoundError(f"File {fn} does not exist.")

    async with await anyio.open_file(fn, "r") as f:
        # with open(fn, "r") as f:
        # Move to the end of the file
        f.seek(0, 2)
        while True:
            line = await f.readline()
            if line:
                await websocket.send_text(line)  # Send the new line to the WebSocket
            else:
                await asyncio.sleep(0.1)  # Wait before trying to read more lines


if "ALEMBIC_RUNNING" not in os.environ:
    logger = start_logger(True, False, log_path=LOG_DIRECTORY)
else:
    logger = None

__all__ = ["logger", "get_last_lines", "stream_new_lines"]
