"""Model for camera configuration."""

import pyorc
from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from orc_api.db import RemoteBase


class CameraConfig(RemoteBase):
    """Model for camera configuration."""

    __tablename__ = "camera_config"
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )
    name: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )
    data: Mapped[str] = mapped_column(
        JSON,
        nullable=False,
    )

    def __str__(self):
        return "{}: ".format(
            self.id,
        )

    def __repr__(self):
        return "{}".format(self.__str__())

    @validates("data")
    def validate_camera_config(self, key, value):
        """Validate that the provided JSON is a valid camera configuration."""
        # try to read the config with pyorc
        try:
            _ = pyorc.CameraConfig(**value)
            return value
        except Exception as e:
            raise ValueError(f"Error while validating camera config: {str(e)}")
