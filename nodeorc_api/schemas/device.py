import uuid

from pydantic import BaseModel, Field
from typing import Optional
from nodeorc.db import DeviceStatus, DeviceFormStatus

# Pydantic model for responses
class DeviceBase(BaseModel):
    name: Optional[str] = Field(default=None, description="Name of the device.")
    operating_system: Optional[str] = Field(default=None, description="Operating system of the device.")
    processor: Optional[str] = Field(default=None, description="Processor of the device.")
    memory: Optional[float] = Field(default=None, description="Memory in GB available on the device.")
    status: Optional[DeviceStatus] = Field(default=DeviceStatus.HEALTHY, description="Status of the device.")
    form_status: Optional[DeviceFormStatus] = Field(default=DeviceFormStatus.NOFORM, description="Form status of the device.")
    nodeorc_version: Optional[str] = Field(default=None, description="Version of nodeorc.")
    message: Optional[str] = Field(default=None, description="Error or status message if any.")

class DeviceResponse(DeviceBase):
    id: uuid.UUID# = Field(description="Device ID")

    class Config:
        orm_mode = True

class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    name: Optional[str]
    operating_system: Optional[str]
    processor: Optional[str]
    memory: Optional[float]
    status: Optional[DeviceStatus]
    form_status: Optional[DeviceFormStatus]
    nodeorc_version: Optional[str]
    message: Optional[str]

