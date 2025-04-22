"""Model for cross section."""

from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from orc_api.db import RemoteBase


class CrossSection(RemoteBase):
    """CrossSection entity in a database."""

    __tablename__ = "cross_section"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now())
    name: Mapped[str] = mapped_column(String, nullable=False)
    features: Mapped[dict] = mapped_column(JSON, nullable=False)

    def __str__(self):
        return "{}: {}".format(self.timestamp, self.name)

    def __repr__(self):
        return "{}".format(self.__str__())
