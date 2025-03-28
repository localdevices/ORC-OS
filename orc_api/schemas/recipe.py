"""Pydantic models for recipes."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from orc_api.db.base import SyncStatus


# Pydantic model for responses
class RecipeBase(BaseModel):
    """Base model for a recipe."""

    name: str = Field(default=None, description="Free recognizable description of cross section.")
    data: dict = Field(description="Recipe data")
    model_config = ConfigDict(from_attributes=True)


class RecipeResponse(RecipeBase):
    """Response model for a recipe."""

    id: int = Field(description="Recipe ID")
    created_at: datetime = Field(description="Creation date")
    remote_id: Optional[int] = Field(default=None, description="ID of the recipe on the remote server")
    sync_status: SyncStatus = Field(default=SyncStatus.LOCAL, description="Status of the recipe on the remote server")
