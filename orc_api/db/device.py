"""Models for device information."""

import enum
import platform
import socket
import uuid
from datetime import datetime

import psutil
from sqlalchemy import DateTime, Enum, Float, String
from sqlalchemy.orm import Mapped, mapped_column

import orc_api
from orc_api.db import Base


class DeviceStatus(enum.Enum):
    """Device status numbers."""

    HEALTHY = 0
    LOW_VOLTAGE = 1
    LOW_STORAGE = 2
    CRITICAL_STORAGE = 3


class DeviceFormStatus(enum.Enum):
    """Device form status numbers."""

    NOFORM = 0  # set at start of device.
    VALID_FORM = 1  # Valid form available
    INVALID_FORM = 2  # if only an invalid form is available
    BROKEN_FORM = 3  # if a valid form used to exist but now is invalid due to system/software changes


class Device(Base):
    """Device model."""

    __tablename__ = "device"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4())
    name: Mapped[str] = mapped_column(String, nullable=False, default=socket.gethostname())
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(), nullable=False)
    operating_system: Mapped[str] = mapped_column(String, nullable=False, default=platform.platform())
    processor: Mapped[str] = mapped_column(String, nullable=False, default=platform.processor())
    memory: Mapped[float] = mapped_column(Float, nullable=False, default=psutil.virtual_memory().total / (1024**3))
    free_storage: Mapped[float] = mapped_column(Float, nullable=False, default=psutil.disk_usage("/").free / (1024**3))
    status: Mapped[enum.Enum] = mapped_column(Enum(DeviceStatus), default=DeviceStatus.HEALTHY)
    form_status: Mapped[enum.Enum] = mapped_column(Enum(DeviceFormStatus), default=DeviceFormStatus.NOFORM)
    orc_os_version: Mapped[str] = mapped_column(String, default=orc_api.__version__, nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=True)  # error message if any

    def __str__(self):
        return "{}".format(self.id)

    def __repr__(self):
        return "{}".format(self.__str__())

    @property
    def as_dict(self):
        """Return the device information as a dictionary."""
        device_info = {
            key: value for key, value in self.__dict__.items() if not key.startswith("_") and not callable(value)
        }
        # replace the datetime by a time string
        device_info["created_at"] = self.created_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        device_info["id"] = str(self.id)
        device_info["status"] = self.status.value
        device_info["form_status"] = self.form_status.value
        device_info["orc_os_version"] = self.orc_os_version

        return device_info
