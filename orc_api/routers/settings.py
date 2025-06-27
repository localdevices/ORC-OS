"""Router for daemon settings."""

from typing import List, Union

from fastapi import APIRouter, Depends, Response

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import Session, Settings
from orc_api.schemas.settings import SettingsCreate, SettingsResponse

router: APIRouter = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/", response_model=Union[SettingsResponse, None], description="Get disk management configuration.")
async def get_settings(db: Session = Depends(get_db)):
    """Get daemon settings configuration."""
    disk_management: List[Settings] = crud.settings.get(db)
    return disk_management


@router.post("/", response_model=None, status_code=201, description="Update disk management configuration.")
async def update_settings(settings: SettingsCreate, db: Session = Depends(get_db)):
    """Update daemon settings configuration."""
    # Check if there is already a device
    existing_settings = crud.settings.get(db)
    try:
        if existing_settings:
            # Update the existing record's fields
            for key, value in settings.model_dump().items():
                setattr(existing_settings, key, value)
            db.commit()
            db.refresh(existing_settings)  # Refresh to get the updated fields
            return existing_settings
        else:
            # Create a new device record if none exists
            new_settings = Settings(**settings.model_dump(exclude_none=True, exclude={"id"}))
            new_settings = crud.settings.add(db, new_settings)
            return new_settings
    except Exception as e:
        return Response(f"Error: {e}", status_code=500)
