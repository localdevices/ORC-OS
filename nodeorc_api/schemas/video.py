import os
from datetime import datetime, timedelta
from io import BytesIO
from pydantic import BaseModel, Field, ConfigDict
from urllib.parse import urljoin
from nodeorc import db as models
from nodeorc_api import crud
from nodeorc_api.database import get_db
from typing import Optional

# Pydantic model for responses
class VideoBase(BaseModel):
    timestamp: datetime = Field(description="Timestamp of the video.")
    camera_config: Optional[int] = Field(description="Camera configuration ID.", default=None)

class VideoCreate(VideoBase):
    pass

class VideoResponse(VideoBase):
    id: int = Field(description="Video ID")
    file: Optional[str] = Field(default=None, description="File name of the video.")
    image: Optional[str] = Field(description="Image file name of the video.")
    thumbnail: Optional[str] = Field(default=None, description="Thumbnail file name of the video.")

    model_config = ConfigDict(from_attributes=True)
    def get_thumbnail(self, base_path: str):
        return os.path.join(base_path, self.thumbnail)

    def get_video_file(self, base_path: str):
        return os.path.join(base_path, self.file)


