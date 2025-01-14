from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


# Pydantic model for responses
class DiskManagementBase(BaseModel):
    home_folder: Optional[str] = Field(default=None, description="Home folder of the device.")
    min_free_space: Optional[float] = Field(default=None, description="GB of minimum free space required.")
    critical_space: Optional[float] = Field(default=None, description="GB of free space critical for the device.")
    frequency: Optional[int] = Field(default=None, description="Frequency [s] for checking disk status and cleanup.")

class DiskManagementResponse(DiskManagementBase):
    id: int = Field(description="Disk management ID")
    created_at: datetime = Field(description="Creation date")

class DiskManagementCreate(DiskManagementBase):
    pass