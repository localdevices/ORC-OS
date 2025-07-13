"""Model for disk management."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from orc_api.db import Base


class DiskManagement(Base):
    """Model for disk management."""

    __tablename__ = "disk_management"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now())

    min_free_space: Mapped[float] = mapped_column(
        Float, default=20, comment="GB of minimum free space required. When space is less, cleanup will be performed"
    )
    critical_space: Mapped[float] = mapped_column(
        Float,
        default=10,
        comment="GB of free space under which the service will shutdown to prevent loss of contact to the device",
    )
    frequency: Mapped[float] = mapped_column(
        Float,
        default=3600,
        comment="Frequency [s] in which the device will be checked for available space and cleanup will occur",
    )
