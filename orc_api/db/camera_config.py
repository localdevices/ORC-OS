import socket
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Integer, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, validates, relationship

from orc_api.db import RemoteBase
import pyorc

class CameraConfig(RemoteBase):
    __tablename__ = "camera_config"
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(),
        nullable=False
    )
    name: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=socket.gethostname()
    )
    camera_calib: Mapped[str] = mapped_column(
        JSON,
        nullable=False,
    )

    def __str__(self):
        return "{}".format(self.id)

    def __repr__(self):
        return "{}".format(self.__str__())

    @validates('camera_calib')
    def validate_camera_config(self, key, value):
        """Validate that the provided JSON is a valid camera configuration."""
        # try to read the config with pyorc
        try:
            _ = pyorc.CameraConfig(**value)
            return value
        except Exception as e:
            raise ValueError(
                f"Error while validating camera config: {str(e)}"
            )

    def callback(self):
        pass