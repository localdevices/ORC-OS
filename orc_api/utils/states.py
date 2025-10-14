"""Video run status helpers for web socket connections."""

import asyncio
import enum
from typing import Optional


class VideoRunStatus(enum.Enum):
    """Status of video as Enum."""

    IDLE = 1
    PROCESSING = 2
    SUCCESS = 3
    ERROR = 9


class SyncRunStatus(enum.Enum):
    """Status of video sync process as Enum."""

    IDLE = 1
    SYNCING = 2
    SUCCESS = 3
    FAILED = 9


class VideoRunState:
    """The state needed to update webdocket details on running videos."""

    @property
    def json(self):
        """Return the state as a JSON object."""
        return {
            "video_file": self.video_file,
            "status": self.status.value,
            "sync_status": self.sync_status.value,
            "message": self.message,
        }

    def __init__(self, video_file: str, status: VideoRunStatus, sync_status: SyncRunStatus, message: str):
        """Initialize the video run state."""
        # self.state = asyncio.Queue()
        self.video_file = video_file
        self.status = status
        self.sync_status = SyncRunStatus.IDLE
        self.message = message
        self.queue = asyncio.Queue()
        # initialize the async state
        state_update = {
            "video_file": self.video_file,
            "status": self.status.value,
            "sync_status": self.sync_status.value,
            "message": self.message,
        }
        self.queue.put_nowait(state_update)

    def update(
        self,
        video_file: Optional[str] = None,
        status: Optional[VideoRunStatus] = None,
        sync_status: Optional[SyncRunStatus] = None,
        message: Optional[str] = None,
    ):
        """Update state."""
        """Change state handler and notify websocket."""
        if video_file:
            self.video_file = video_file
            # state_update["video_file"] = video_file
        if status:
            self.status = status
        if sync_status:
            self.sync_status = sync_status
        if message:
            self.message = message
        # update the async state
        state_update = {
            "video_file": self.video_file,
            "status": self.status.value,
            "sync_status": self.sync_status.value,
            "message": self.message,
        }
        self.queue.put_nowait(state_update)


video_run_state = VideoRunState(video_file="", status=VideoRunStatus.IDLE, sync_status=SyncRunStatus.IDLE, message="")
