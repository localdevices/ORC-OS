"""Router for water level settings."""

from datetime import datetime
from typing import List, Union

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import WaterLevelSettings
from orc_api.schemas.water_level import WaterLevelCreate, WaterLevelResponse

router: APIRouter = APIRouter(prefix="/water_level", tags=["water_level"])


@router.get("/", response_model=Union[WaterLevelResponse, None], description="Get water level configuration")
async def get_water_level(db: Session = Depends(get_db)):
    """Get water level settings."""
    water_level_settings: List[WaterLevelSettings] = crud.water_level.get(db)
    return water_level_settings


@router.post("/", response_model=WaterLevelResponse, status_code=201, description="Update water level configuration")
async def update_water_level(water_level_settings: WaterLevelCreate, db: Session = Depends(get_db)):
    """Update water level settings."""
    try:
        # Check if there is already a water level settings record
        wl_settings = crud.water_level.get(db)
        if wl_settings:
            # Update the existing record's fields
            for key, value in water_level_settings.model_dump(exclude_none=True).items():
                setattr(wl_settings, key, value)
            # also update the creation date
            wl_settings.created_at = datetime.now()
            db.commit()
            db.refresh(wl_settings)  # Refresh to get the updated fields
        else:
            # Create a new water level settings record if none exists
            wl_settings = WaterLevelSettings(**water_level_settings.model_dump(exclude_none=True, exclude={"id"}))
            db.add(wl_settings)
            db.commit()
            db.refresh(wl_settings)

        return wl_settings
    except Exception as e:
        return Response(f"Error: {e}", status_code=500)
