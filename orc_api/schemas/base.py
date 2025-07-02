"""Pydantic base model for remote syncing schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db.base import SyncStatus
from orc_api.schemas.callback_url import CallbackUrlResponse


# Default fields of Pydantic model for responses of Remote models
class RemoteModel(BaseModel):
    """Base model for a cross-section."""

    id: Optional[int] = Field(default=None, description="Record ID")
    created_at: Optional[datetime] = Field(default=None, description="Creation date")
    remote_id: Optional[int] = Field(default=None, description="Record ID on the remote server")
    sync_status: SyncStatus = Field(default=SyncStatus.LOCAL, description="Status of the record on the remote server")

    def sync_remote(self, session: Session, endpoint: str, data=None, json=None, files=None, timeout=5):
        """Send remote updates to LiveORC API."""
        callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(session))
        if callback_url is None:
            raise ValueError("No callback URL configured. Please ensure you first gain access to a LiveORC API.")
        # get all callback functionalities in place.
        if self.remote_id is not None:
            # add the id to the end point and only patch existing record
            r = callback_url.patch(
                endpoint=endpoint + f"{self.remote_id}/", data=data, json=json, files=files, timeout=timeout
            )
        else:
            r = callback_url.post(endpoint=endpoint, data=data, json=json, files=files, timeout=timeout)
        # put back the remote id
        if r.status_code in [200, 201]:
            # success
            # get the ids back in the right order
            response_data = r.json()
            response_data["remote_id"] = response_data.pop("id")
            response_data["sync_status"] = SyncStatus.SYNCED.value
            response_data["id"] = self.id
            return response_data
        else:
            self.sync_status = SyncStatus.FAILED
            raise ValueError(f"Remote update failed with status code {r.status_code}.")
