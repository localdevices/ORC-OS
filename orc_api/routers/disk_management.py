"""Disk management API router for ORC-OS."""

from typing import List, Union

from fastapi import APIRouter, Depends, Response

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import DiskManagement, Session
from orc_api.schemas.disk_management import DiskManagementCreate, DiskManagementResponse

router: APIRouter = APIRouter(prefix="/disk_management", tags=["disk_management"])


@router.get("/", response_model=Union[DiskManagementResponse, None], description="Get disk management configuration.")
async def get_disk_management_settings(db: Session = Depends(get_db)):
    """Get the current disk management settings."""
    disk_management: List[DiskManagement] = crud.disk_management.get(db)
    return disk_management


@router.post("/", response_model=None, status_code=201, description="Update disk management configuration.")
async def update_disk_management(dm: DiskManagementCreate, db: Session = Depends(get_db)):
    """Update or create disk management settings."""
    # Update or create
    try:
        crud.disk_management.create_update(db, dm)
    except Exception as e:
        return Response(f"Error: {e}", status_code=500)
