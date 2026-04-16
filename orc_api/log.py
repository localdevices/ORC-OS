"""Logging utilities."""

import asyncio
import logging
import logging.handlers
import os
import sys
import warnings
from collections import deque
from datetime import datetime
from typing import Optional

from fastapi import WebSocket

try:
    from concurrent_log_handler import ConcurrentRotatingFileHandler
except ImportError:
    ConcurrentRotatingFileHandler = None

from orc_api import LOG_DIRECTORY, __home__

FMT = "%(asctime)s - %(name)s - %(module)s - %(levelname)s - %(message)s"
TS_FMT = "%Y-%m-%d %H:%M:%S,%f"


def _log_component() -> str:
    """Determine component type for process-local logfile selection."""
    component = os.getenv("ORC_LOG_COMPONENT")
    if component:
        # return only if specifically configured. Useful for e.g. testing or more control in deployment of docker.
        return component.lower()
    argv = " ".join(sys.argv).lower()
    if "celery" in argv:
        return "celery"
    return "api"


def get_log_files(log_path: Optional[str] = None) -> list[str]:
    """Return the API and Celery logfile paths."""
    if not log_path:
        log_path = LOG_DIRECTORY
    return [
        os.path.abspath(os.path.join(log_path, "orc-os.log")),
        os.path.abspath(os.path.join(log_path, "orc-os-celery.log")),
    ]


class FunctionFilter(logging.Filter):
    """Custom logging filter to limit logs to a specific function."""

    def __init__(self, function_name: str):
        super().__init__()
        self.function_name = function_name

    def filter(self, record: logging.LogRecord) -> bool:
        """Only allow logs from the specific function."""
        return record.funcName == self.function_name


def setuplog(
    name: str = "orc-os",
    path: Optional[str] = None,
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
        add_filehandler(logger, path, log_level=log_level, fmt=fmt, append=append, backupCount=10)
    return logger


def add_filehandler(logger, path, log_level=20, fmt=FMT, append=True, backupCount=0, function=None):
    """Add file handler to logger."""
    if not os.path.isdir(os.path.dirname(path)):
        os.makedirs(os.path.dirname(path))
    if backupCount > 0:
        max_bytes = int(os.getenv("ORC_LOG_MAX_BYTES", str(10 * 1024 * 1024)))
        if ConcurrentRotatingFileHandler is not None:
            ch = ConcurrentRotatingFileHandler(
                path,
                maxBytes=max_bytes,
                backupCount=backupCount,
                encoding="utf-8",
            )
            ch.doRollover()  # rollover on startup to avoid multiple processes writing to the same file indefinitely
        else:
            warnings.warn(
                "concurrent_log_handler not installed; falling back to stdlib RotatingFileHandler. "
                "Multi-process log rotation may cause file corruption.",
                RuntimeWarning,
                stacklevel=2,
            )
            ch = logging.handlers.RotatingFileHandler(
                path,
                maxBytes=max_bytes,
                backupCount=backupCount,
                encoding="utf-8",
            )
    else:
        mode = "a" if append else "w"
        ch = logging.FileHandler(path, mode=mode, encoding="utf-8")
    ch.setFormatter(logging.Formatter(fmt))
    ch.setLevel(log_level)
    # add filter
    if function:
        # only log for defined function
        func_filter = FunctionFilter(function)
        ch.addFilter(func_filter)
    logger.addHandler(ch)


def remove_file_handler(logger, name_contains="hello_world"):
    """Remove file handler with name_contains in file name from logger."""
    for handler in logger.handlers:
        if isinstance(handler, logging.FileHandler):
            if name_contains in handler.baseFilename:
                logger.removeHandler(handler)
                handler.close()
                logger.debug(f"Removed file handler to {handler.baseFilename} from logger.")


def start_logger(verbose, quiet, log_path=None) -> logging.Logger:
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
    logfile_name = "orc-os-celery.log" if _log_component() == "celery" else "orc-os.log"
    logfile = os.path.abspath(os.path.join(log_path, logfile_name))
    log_level = max(10, 30 - 10 * (verbose - quiet))
    logger = setuplog(name="ORC-OS", path=logfile, log_level=log_level)
    return logger


def _parse_log_timestamp(line: str) -> datetime:
    """Parse timestamp from the shared log format."""
    try:
        return datetime.strptime(line[:23], TS_FMT)
    except Exception:
        return datetime.min


def _tail_lines(fn: str, count: int) -> list[str]:
    """Read last count lines from text file."""
    if not os.path.exists(fn):
        return []
    with open(fn, encoding="utf-8", errors="ignore") as f:
        return list(deque(f, maxlen=count))


def get_merged_last_lines(files: list[str], count: int = 500) -> str:
    """Get last lines merged across files, ordered by timestamp."""
    restricted_count = min(count, 500)
    merged = []
    for fn in files:
        for i, line in enumerate(_tail_lines(fn, restricted_count)):
            merged.append((_parse_log_timestamp(line), i, line))
    merged.sort(key=lambda x: (x[0], x[1]))
    return "".join(item[2] for item in merged[-restricted_count:])


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


async def stream_new_lines(websocket: WebSocket, files: list[str]):
    """Stream new lines from multiple files, merged in timestamp order."""
    from starlette.websockets import WebSocketDisconnect

    offsets = {}
    for fn in files:
        offsets[fn] = os.path.getsize(fn) if os.path.exists(fn) else 0

    try:
        while True:
            new_entries = []
            for fn in files:
                if not os.path.exists(fn):
                    offsets[fn] = 0
                    continue

                file_size = os.path.getsize(fn)
                if file_size < offsets.get(fn, 0):
                    # File was rotated/truncated; continue from beginning of new file.
                    offsets[fn] = 0

                with open(fn, encoding="utf-8", errors="ignore") as f:
                    f.seek(offsets.get(fn, 0))
                    for line in f:
                        # parse as tuple with datetime, line (str)
                        new_entries.append((_parse_log_timestamp(line), line))
                    offsets[fn] = f.tell()

            if new_entries:
                # sort on timestamp (first entry) of tuple, to ensure messages appear chronologically
                new_entries.sort(key=lambda x: x[0])
                for _, line in new_entries:
                    await websocket.send_text(line)

            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        return
    except asyncio.CancelledError:
        return


logger = start_logger(True, False, log_path=LOG_DIRECTORY)

__all__ = ["logger", "get_last_lines", "get_log_files", "get_merged_last_lines", "stream_new_lines"]
