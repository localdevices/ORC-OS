"""Pydantic models for devices."""

import platform
import uuid
from typing import Optional, Self

import psutil
from pydantic import BaseModel, ConfigDict, Field, model_validator

import orc_api
from orc_api.db import DeviceFormStatus, DeviceStatus
from orc_api.utils import sys_utils


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
    orc_os_release: Optional[str] = Field(default=None, description="Release name of ORC-OS.")
    message: Optional[str] = Field(default=None, description="Error or status message if any.")


class DeviceResponse(DeviceBase):
    """Response schema for device."""

    id: uuid.UUID  # = Field(description="Device ID")
    used_memory: float = Field(
        default=(psutil.virtual_memory().total - psutil.virtual_memory().available) / 1024**3,
        description="Used memory in GB available on the device.",
    )
    used_disk_space: float = Field(
        default=(psutil.disk_usage("/").total - psutil.disk_usage("/").free) / 1024**3,
        description="Used disk space in GB available on the device.",
    )
    disk_space: float = Field(
        default=(psutil.disk_usage("/").total) / 1024**3,
        description="Total disk space in GB available on the device.",
    )
    ip_address: str = Field(default="127.0.0.1", description="Current IP address of the device.")
    hostname: str = Field(default="localhost", description="Hostname of the device.")

    model_config = ConfigDict(from_attributes=True)
    orc_os_version: str = Field(default=orc_api.__version__, description="Version of ORC-OS.")
    orc_os_release: str = Field(default=orc_api.__release__, description="Release name of ORC-OS.")

    @model_validator(mode="after")
    def add_current_status(self) -> Self:
        """Add additional current information about device."""
        self.orc_os_version = orc_api.__version__
        self.orc_os_release = orc_api.__release__
        self.operating_system = platform.platform()
        self.processor = platform.processor()
        self.ip_address = sys_utils.get_primary_internal_ip()
        self.hostname = sys_utils.get_hostname()
        return self


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
