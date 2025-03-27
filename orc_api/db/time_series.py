"""Model for water level time series."""

from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from orc_api.db import RemoteBase

class TimeSeries(RemoteBase):
    """
    Represents water level data with timestamp and value.

    This class is used to define and manage water level records in NodeORC database.
    It is designed to store the time of measurement and the corresponding water
    level value. It can be utilized for environmental monitoring, flood prediction,
    and other relevant applications. The data is stored as structured records,
    facilitating analysis and querying.

    Attributes
    ----------
    id : int
        Unique identifier for each water level record.
    timestamp : datetime
        The date and time when the water level measurement was taken. Defaults to
        the current UTC datetime at the time of record creation.
    level : float
        The measured water level value. This attribute is mandatory.
    """
    __tablename__ = "time_series"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now())
    h: Mapped[float] = mapped_column(Float, nullable=False)
    q_05: Mapped[float] = mapped_column(Float, nullable=True)
    q_25: Mapped[float] = mapped_column(Float, nullable=True)
    q_50: Mapped[float] = mapped_column(Float, nullable=True)
    q_75: Mapped[float] = mapped_column(Float, nullable=True)
    q_95: Mapped[float] = mapped_column(Float, nullable=True)
    wetted_surface: Mapped[float] = mapped_column(Float, nullable=True)
    wetted_perimeter: Mapped[float] = mapped_column(Float, nullable=True)
    fraction_velocimetry: Mapped[float] = mapped_column(Float, nullable=True)

    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("video.id"))
    video = relationship("Video", uselist=False, back_populates="time_series")

    def __str__(self):
        return "{}: {}".format(self.timestamp, self.h)

    def __repr__(self):
        return "{}".format(self.__str__())
