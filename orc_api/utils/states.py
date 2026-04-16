"""Video run status helpers for web socket connections."""

import enum


class VideoRunStatus(enum.Enum):
    """Status of video as Enum."""

    IDLE = 1
    PROCESSING = 3
    SUCCESS = 4
    ERROR = 5


class SyncRunStatus(enum.Enum):
    """Status of video sync process as Enum."""

    IDLE = 1
    SUCCESS = 2
    UPDATED = 3
    FAILED = 4
    SYNCING = 5
