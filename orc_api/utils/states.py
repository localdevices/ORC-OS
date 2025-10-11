"""Video run status helpers for web socket connections."""

import enum
from typing import Optional


class VideoRunStatus(enum.Enum):
    """Status of video as Enum."""

    IDLE = 1
    PROCESSING = 2
    SUCCESS = 3
    ERROR = 9


class VideoRunState:
    """The state needed to update webdocket details on running videos."""

    def __init__(self, video_file: str, status: VideoRunStatus, message: str):
        """Initialize the video run state."""
        # self.state = asyncio.Queue()
        self.video_file = video_file
        self.status = status
        self.message = message
        # self.state.put({"video_file": video_file, "status": status, "message": message})

    def update(
        self, video_file: Optional[str] = None, status: Optional[VideoRunStatus] = None, message: Optional[str] = None
    ):
        """Update state."""
        """Change state handler and notify websocket."""
        if video_file:
            self.video_file = video_file
            # state_update["video_file"] = video_file
        if status:
            self.status = status
        if message:
            self.message = message
        print(f"STATE updated {self.status}")
        # self.state.put(state_update)


video_run_state = VideoRunState(video_file="", status=VideoRunStatus.IDLE, message="")
