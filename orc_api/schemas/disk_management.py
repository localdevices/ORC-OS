"""Pydantic models for disk management."""

import os
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from orc_api import INCOMING_DIRECTORY, UPLOAD_DIRECTORY
from orc_api.log import logger
from orc_api.utils import disk_management as dm


# Pydantic model for responses
class DiskManagementBase(BaseModel):
    """Base schema for disk management."""

    min_free_space: Optional[float] = Field(default=None, description="GB of minimum free space required.")
    critical_space: Optional[float] = Field(default=None, description="GB of free space critical for the device.")
    frequency: Optional[int] = Field(default=None, description="Frequency [s] for checking disk status and cleanup.")

    @property
    def incoming_path(self):
        """Path to the incoming folder."""
        path = INCOMING_DIRECTORY
        if not os.path.exists(path):
            os.makedirs(path)
        return path

    @property
    def failed_path(self):
        """Path to the failed folder."""
        path = os.path.join(UPLOAD_DIRECTORY, "failed")
        if not os.path.exists(path):
            os.makedirs(path)
        return path

    @property
    def results_path(self):
        """Path to the results folder."""
        path = os.path.join(UPLOAD_DIRECTORY, "results")
        if not os.path.exists(path):
            os.makedirs(path)
        return path

    @property
    def log_path(self):
        """Path to the logs folder."""
        path = os.path.join(UPLOAD_DIRECTORY, "logs")
        if not os.path.exists(path):
            os.makedirs(path)
        return path

    def cleanup(self):
        """Perform disk cleanup activities (should be run in scheduler)."""
        # check disk space
        free_space = dm.get_free_space(
            self.home_folder,
        )
        logger.debug(f"Checking if free space is sufficient (>= {self.min_free_space})")
        if free_space < self.min_free_space:
            logger.warning(f"Available space is lower than {self.min_free_space}, purging failed folder.")
            ret = dm.purge(
                [self.failed_path],
                free_space=free_space,
                min_free_space=self.min_free_space,
                logger=logger,
                home=self.home_folder,
            )
            if not ret:
                logger.warning("Space after purging still not sufficient. Purging results folder.")
                free_space = dm.get_free_space(self.home_folder)
                ret = dm.purge(
                    [self.results_path],
                    free_space=free_space,
                    min_free_space=self.min_free_space,
                    logger=logger,
                    home=self.home_folder,
                )
                if not ret:
                    free_space = dm.get_free_space(self.home_folder)
                    logger.warning(
                        f"Space after purging is {free_space} and under minimum allowed space {self.min_free_space}. "
                        f"Please contact your system administrator."
                    )


class DiskManagementResponse(DiskManagementBase):
    """Response schema for disk management."""

    id: int = Field(description="Disk management ID")
    created_at: datetime = Field(description="Creation date")
    # ensure instances can be created from sqlalchemy model instances
    model_config = ConfigDict(from_attributes=True)


class DiskManagementCreate(DiskManagementBase):
    """Create schema for disk management."""

    pass
