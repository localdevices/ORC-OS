"""CRUD operations for time series."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.query import Query

from orc_api import db as models
from orc_api.crud import generic


def filter_start_stop(
    query: Query, start: Optional[datetime] = None, stop: Optional[datetime] = None, desc: Optional[bool] = None
):
    """Filter query by start and stop datetime."""
    desc = desc if desc is not None else True
    if start:
        query = query.where(models.TimeSeries.timestamp >= start)
    if stop:
        query = query.where(models.TimeSeries.timestamp <= stop)
    # order from last to first
    if desc:
        return query.order_by(models.TimeSeries.timestamp.desc())
    return query


def get_query_by_id(db: Session, id: int):
    """Get a single time series record by id."""
    return db.query(models.TimeSeries).filter(models.TimeSeries.id == id)


def get_query_list(
    db: Session,
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    desc: Optional[bool] = None,
    count: Optional[int] = None,
):
    """Get a query of time series (not yet extracted)."""
    query = db.query(models.TimeSeries)
    query = filter_start_stop(query, start, stop, desc)
    if count is not None:
        # limit the amount of returned records to "count"
        query = query.limit(count)
    return query


def get(db: Session, id: int):
    """Get single time series record by id."""
    query = get_query_by_id(db=db, id=id)
    if query.count() == 0:
        return
    return query.first()


def get_list(
    db: Session,
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    desc: Optional[bool] = True,
    video_config_ids: Optional[List[int]] = None,
    count: Optional[int] = None,
):
    """Get records of time series."""
    query = get_query_list(db=db, start=start, stop=stop, count=count, desc=desc)
    ts_list = query.all()
    if not video_config_ids:
        return ts_list
    ts_final = []
    # filter out those that are in video_config_ids
    for ts in ts_list:
        if ts.video:
            if ts.video.video_config_id in video_config_ids:
                ts_final.append(ts)
        else:
            if 0 in video_config_ids:
                # also append if zero in list of video_config_ids
                ts_final.append(ts)
    return ts_final


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
