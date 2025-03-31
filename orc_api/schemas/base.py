"""Pydantic base model for remote syncing schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from orc_api import crud
from orc_api.database import get_session
from orc_api.db.base import SyncStatus
from orc_api.schemas.callback_url import CallbackUrlResponse


# Default fields of Pydantic model for responses of Remote models
class RemoteModel(BaseModel):
    """Base model for a cross-section."""

    id: int = Field(description="Record ID")
    created_at: datetime = Field(description="Creation date")
    remote_id: Optional[int] = Field(default=None, description="Record ID on the remote server")
    sync_status: SyncStatus = Field(default=SyncStatus.LOCAL, description="Status of the record on the remote server")

    def callback(self, endpoint: str, data=None, files=None):
        """Send remote updates to LiveORC API."""
        db = get_session()
        callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(db))
        if callback_url is None:
            raise ValueError("No callback URL configured. Please ensure you first gain access to a LiveORC API.")
        # get all callback functionalities in place.
        if self.remote_id is not None:
            data["id"] = self.remote_id
        callback_url.post(endpoint=endpoint, data=data, files=files)
