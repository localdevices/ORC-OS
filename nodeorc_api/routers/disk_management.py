from fastapi import APIRouter, Depends, Response
from nodeorc.db import Session, DiskManagement
from typing import List, Union

from nodeorc_api.schemas.disk_management import DiskManagementResponse, DiskManagementCreate
from nodeorc_api.database import get_db
from nodeorc_api import crud

router: APIRouter = APIRouter(prefix="/disk_management", tags=["disk_management"])

@router.get("/", response_model=Union[DiskManagementResponse, None], description="Get disk management configuration.")
async def get_disk_management_settings(db: Session = Depends(get_db)):
    disk_management: List[DiskManagement] = crud.disk_management.get(db)
    return disk_management


@router.post("/", response_model=None, status_code=201, description="Update disk management configuration.")
async def update_device(dm: DiskManagementCreate, db: Session = Depends(get_db)):
    # Check if there is already a device
    existing_dm = crud.disk_management.get(db)
    try:
        if existing_dm:
            # Update the existing record's fields
            for key, value in dm.model_dump(exclude_none=True).items():
                setattr(existing_dm, key, value)
            db.commit()
            db.refresh(existing_dm)  # Refresh to get the updated fields
            return existing_dm
        else:
            # Create a new device record if none exists
            new_dm = DiskManagement(**dm.model_dump(exclude_none=True, exclude={"id"}))
            db.add(new_dm)
            db.commit()
            db.refresh(new_dm)
            return new_dm
    except Exception as e:
        return Response(f"Error: {e}", status_code=500)
