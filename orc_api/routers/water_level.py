from fastapi import APIRouter, Depends, Response, HTTPException
from orc_api.db import Session, WaterLevelSettings
from typing import List, Union

from orc_api.schemas.water_level import WaterLevelCreate, WaterLevelResponse
from orc_api.database import get_db
from orc_api import crud

router: APIRouter = APIRouter(prefix="/water_level", tags=["water_level"])

@router.get("/", response_model=Union[WaterLevelResponse, None], description="Get water level configuration")
async def get_water_level(db: Session = Depends(get_db)):
    water_level_settings: List[WaterLevelSettings] = crud.water_level.get(db)
    return water_level_settings


@router.post("/", response_model=WaterLevelResponse, status_code=201, description="Update water level configuration")
async def update_water_level(water_level_settings: WaterLevelCreate, db: Session = Depends(get_db)):
    # Check if there is already a device
    try:
        existing_wl_settings = crud.water_level.get(db)
        if existing_wl_settings:
            # Update the existing record's fields
            for key, value in water_level_settings.model_dump(exclude_none=True).items():
                setattr(existing_wl_settings, key, value)
            db.commit()
            db.refresh(existing_wl_settings)  # Refresh to get the updated fields
            return existing_wl_settings
        else:
            # Create a new device record if none exists
            new_wl_settings = WaterLevelSettings(**water_level_settings.model_dump(exclude_none=True, exclude={"id"}))
            db.add(new_wl_settings)
            db.commit()
            db.refresh(new_wl_settings)
            return new_wl_settings
    except Exception as e:
        return Response(f"Error: {e}", status_code=500)
        # raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

