"""CRUD operations for time series."""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from orc_api import db as models
from orc_api.crud import generic


def get_closest(
    db: Session,
    timestamp: datetime,
    allowed_dt: Optional[float] = None,
):
    """Fetch the water level closest to the given timestamp (None if further away than allowed_dt)."""
    return generic.get_closest(db.query(models.TimeSeries), models.TimeSeries, timestamp, allowed_dt)


def add(db: Session, time_series: models.TimeSeries) -> models.TimeSeries:
    """Add a recipe to the database."""
    db.add(time_series)
    db.commit()
    db.refresh(time_series)
    return time_series
