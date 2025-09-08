"""Device status router."""

from typing import Dict, List

import psutil
from fastapi import APIRouter, Depends

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import Device, DeviceFormStatus, DeviceStatus, Session
from orc_api.schemas.device import DeviceCreate, DeviceResponse

router: APIRouter = APIRouter(prefix="/device", tags=["device"])


@router.get("/", response_model=DeviceResponse, description="Get device information")
async def get_device(db: Session = Depends(get_db)):
    """Get live device information."""
    device: List[Device] = crud.device.get(db)
    device = DeviceResponse.model_validate(device)
    # update the memory and disk statuses
    device.used_memory = (psutil.virtual_memory().total - psutil.virtual_memory().available) / 1024**3
    device.used_disk_space = (psutil.disk_usage("/").total - psutil.disk_usage("/").free) / 1024**3
    device.disk_space = (psutil.disk_usage("/").total) / 1024**3
    return device


@router.get("/statuses/", response_model=List[Dict], description="Get all available status options for devices")
async def get_device_statuses():
    """Get all available status options for devices."""
    return [{"key": status.name, "value": status.value} for status in DeviceStatus]


@router.get("/form_statuses/", response_model=List[Dict], description="Get all available form status options")
async def get_device_form_statuses():
    """Get all available form status options."""
    return [{"key": status.name, "value": status.value} for status in DeviceFormStatus]


@router.post("/", response_model=DeviceResponse, status_code=201, description="Update device information")
async def update_device(device: DeviceCreate, db: Session = Depends(get_db)):
    """Update device information."""
    # Check if there is already a device
    existing_device = crud.device.get(db)
    if existing_device:
        # Update the existing record's fields
        for key, value in device.model_dump(exclude_none=True).items():
            setattr(existing_device, key, value)
        db.commit()
        db.refresh(existing_device)  # Refresh to get the updated fields
        return existing_device
    else:
        # Create a new device record if none exists
        new_device = Device(**device.model_dump(exclude_none=True, exclude={"id"}))
        db.add(new_device)
        db.commit()
        db.refresh(new_device)
        return new_device
