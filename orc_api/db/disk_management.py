"""Model for disk management."""

import os

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Integer
from orc_api.db import Base
from sqlalchemy.orm import validates, Mapped, mapped_column

class DiskManagement(Base):
    __tablename__ = 'disk_management'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now())
    home_folder: Mapped[str] = mapped_column(
        String,
        default="/home",
        comment = "Path to folder from which to scan for available disk space"
    )

    min_free_space: Mapped[float] = mapped_column(
        Float,
        default=20,
        comment="GB of minimum free space required. When space is less, cleanup will be performed"
    )
    critical_space: Mapped[float] = mapped_column(
        Float,
        default=10,
        comment="GB of free space under which the service will shutdown to prevent loss of contact to the device"
    )
    frequency: Mapped[float] = mapped_column(
        Float,
        default=3600,
        comment="Frequency [s] in which the device will be checked for available space and cleanup will occur"
    )

    @validates("home_folder")
    def validate_home_folder(self, key, value):
        """Validate that home folder exists."""
        if not(os.path.isdir(value)):
            raise IOError(f"home_folder {value} is not available, disk may be disconnected or wrong path supplied.")
        return value

    @property
    def incoming_path(self):
        return create_join_path(self.home_folder, "incoming")

    @property
    def failed_path(self):
        return create_join_path(self.home_folder, "failed")

    @property
    def success_path(self):
        return create_join_path(self.home_folder, "success")

    @property
    def results_path(self):
        return create_join_path(self.home_folder, "results")

    @property
    def water_level_path(self):
        return create_join_path(self.home_folder, "water_level")

    @property
    def log_path(self):
        return create_join_path(self.home_folder, "log")

    @property
    def tmp_path(self):
        return create_join_path(self.home_folder, "tmp")

    def __str__(self):
        return "DiskManagement {} ({})".format(self.created_at, self.id)

    def __repr__(self):
        return "{}".format(self.__str__())

def create_join_path(folder, subfolder):
    p = os.path.join(folder, subfolder)
    if not (os.path.isdir(p)):
        try:
            os.makedirs(p)
        except:
            # directory creation fails, e.g. because of rights or unavailability of disk (USB stick removed).
            return None
    return p


