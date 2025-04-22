"""CRUD operations for time series."""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from orc_api import db as models
from orc_api.crud import generic


def get_query_by_id(db: Session, id: int):
    """Get a single time series record by id."""
    return db.query(models.TimeSeries).filter(models.TimeSeries.id == id)


def get(db: Session, id: int):
    """Get single time series record by id."""
    query = get_query_by_id(db=db, id=id)
    if query.count() == 0:
        return
    return query.first()


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


def update(db: Session, id: int, time_series: dict):
    """Update a time series record using the TimeSeriesResponse instance."""
    rec = get_query_by_id(db=db, id=id)
    if not rec.first():
        raise ValueError(f"Time series with id {id} does not exist. Create a record first.")
    # update_data = time_series.model_dump(exclude_unset=True, exclude=["id"])
    rec.update(time_series)
    db.commit()
    db.flush()
    return rec.first()
