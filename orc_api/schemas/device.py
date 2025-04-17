"""Pydantic models for devices."""

import uuid
from typing import Optional

import psutil
from pydantic import BaseModel, ConfigDict, Field

from orc_api.db import DeviceFormStatus, DeviceStatus


# Pydantic model for responses
class DeviceBase(BaseModel):
    """Base schema for device."""

    name: Optional[str] = Field(default=None, description="Name of the device.")
    operating_system: Optional[str] = Field(default=None, description="Operating system of the device.")
    processor: Optional[str] = Field(default=None, description="Processor of the device.")
    memory: Optional[float] = Field(default=None, description="Memory in GB available on the device.")
    status: Optional[DeviceStatus] = Field(default=DeviceStatus.HEALTHY, description="Status of the device.")
    form_status: Optional[DeviceFormStatus] = Field(
        default=DeviceFormStatus.NOFORM, description="Form status of the device."
    )
    orc_os_version: Optional[str] = Field(default=None, description="Version of ORC-OS.")
    message: Optional[str] = Field(default=None, description="Error or status message if any.")


class DeviceResponse(DeviceBase):
    """Response schema for device."""

    id: uuid.UUID  # = Field(description="Device ID")
    used_memory: float = Field(
        default=(psutil.virtual_memory().total - psutil.virtual_memory().available) / 1024**3,
        description="Used memory in GB available on the device.",
    )

    model_config = ConfigDict(from_attributes=True)


class DeviceCreate(DeviceBase):
    """Create schema for device."""

    pass


class DeviceUpdate(BaseModel):
    """Update schema for device."""

    name: Optional[str]
    operating_system: Optional[str]
    processor: Optional[str]
    memory: Optional[float]
    status: Optional[DeviceStatus]
    form_status: Optional[DeviceFormStatus]
    orc_os_version: Optional[str]
    message: Optional[str]
