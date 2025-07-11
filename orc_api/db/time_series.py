"""Model for water level time series."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, event, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orc_api.db import RemoteBase


class TimeSeries(RemoteBase):
    """Represents water level data with timestamp and value.

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
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(), index=True)
    h: Mapped[float] = mapped_column(Float, nullable=False)
    q_05: Mapped[float] = mapped_column(Float, nullable=True)
    q_25: Mapped[float] = mapped_column(Float, nullable=True)
    q_50: Mapped[float] = mapped_column(Float, nullable=True)
    q_75: Mapped[float] = mapped_column(Float, nullable=True)
    q_95: Mapped[float] = mapped_column(Float, nullable=True)
    q_raw: Mapped[float] = mapped_column(Float, nullable=True)
    v_av: Mapped[float] = mapped_column(Float, nullable=True)
    v_bulk: Mapped[float] = mapped_column(Float, nullable=True)
    wetted_surface: Mapped[float] = mapped_column(Float, nullable=True)
    wetted_perimeter: Mapped[float] = mapped_column(Float, nullable=True)
    fraction_velocimetry: Mapped[float] = mapped_column(Float, nullable=True)

    video = relationship("Video", uselist=False, back_populates="time_series")  # foreign_keys=[video_id]

    def __str__(self):
        return "{}: {}".format(self.timestamp, self.h)

    def __repr__(self):
        return "{}".format(self.__str__())


@event.listens_for(TimeSeries, "after_insert")
def add_video(mapper, connection, target):
    """Add video to time series if close enough in time."""
    from orc_api import crud
    from orc_api.db import Session
    from orc_api.log import logger

    # check if a record is available
    db = Session(bind=connection)
    settings = crud.settings.get(db)
    if settings:
        timestamp = datetime.now() if not target.timestamp else target.timestamp
        video_record = crud.video.get_closest_no_ts(
            db,
            timestamp,
            allowed_dt=settings.allowed_dt,
        )
        if video_record:
            update_query = text(
                """
                UPDATE video
                SET time_series_id = :time_series_id
                WHERE id = :video_id
                """
            )
            connection.execute(update_query, {"time_series_id": target.id, "video_id": video_record.id})

    else:
        logger.warning("No settings available, cannot attach time series to videos.")
