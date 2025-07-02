"""CRUD operations for videos."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.sql.selectable import Select

from orc_api import db as models
from orc_api.crud import generic


def filter_start_stop(query: Select, start: Optional[datetime] = None, stop: Optional[datetime] = None):
    """Filter query by start and stop datetime."""
    if start:
        query = query.where(models.Video.timestamp >= start)
    if stop:
        query = query.where(models.Video.timestamp < stop)
    return query.order_by(models.Video.timestamp)


def filter_status(query: Select, status: Optional[models.VideoStatus] = None):
    """Filter query by start and stop datetime."""
    if status:
        query = query.where(models.Video.status == status)
    return query


def get_query_by_id(db: Session, id: int):
    """Get a single video in a query (e.g. for updating."""
    return db.query(models.Video).filter(models.Video.id == id)


def get(db: Session, id: int):
    """Get a single video."""
    query = get_query_by_id(db=db, id=id)
    if query.count() == 0:
        return
    return query.first()


def get_closest(
    db: Session,
    timestamp: datetime,
    allowed_dt: Optional[float] = None,
):
    """Fetch the video closest to the given timestamp (None if further away than allowed_dt)."""
    return generic.get_closest(db.query(models.Video), models.Video, timestamp, allowed_dt)


def get_closest_no_ts(
    db: Session,
    timestamp: datetime,
    allowed_dt: Optional[float] = None,
):
    """Fetch the video without time stamp closest to the given timestamp."""
    # first get video records that do not contain any time series
    q = db.query(models.Video).filter(models.Video.time_series_id == None)  # noqa
    # within these, find the one closest in time to the time stamp
    return generic.get_closest(q, models.Video, timestamp, allowed_dt)


def get_ids(db: Session, ids: List[int] = None) -> List[models.Video]:
    """List videos from provided ids."""
    ids = [] if ids is None else ids
    query = db.query(models.Video).filter(models.Video.id.in_(ids))
    return query.all()


def get_list(
    db: Session,
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    status: Optional[models.VideoStatus] = None,
) -> List[models.Video]:
    """List videos within time span of start and stop."""
    query = db.query(models.Video)
    query = filter_start_stop(query, start, stop)
    if status:
        query = filter_status(query, status)
    return query.all()


def delete(db: Session, id: int):
    """Delete a single video."""
    query = db.query(models.Video).filter(models.Video.id == id)
    if query.count() == 0:
        raise ValueError(f"Video with id {id} does not exist.")
    video = query.first()
    db.delete(video)
    db.commit()
    return


def delete_start_stop(db: Session, start: datetime, stop: datetime):
    """Delete all videos between start and stop datetime."""
    query = db.query(models.Video)
    query = filter_start_stop(query, start, stop)
    query.delete()
    db.commit()
    return


def add(db: Session, video: models.Video) -> models.Video:
    """Add a video to the database."""
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


def update(db: Session, id: int, video: dict):
    """Update a video record using the VideoResponse instance."""
    rec = get_query_by_id(db=db, id=id)
    if not rec.first():
        raise ValueError(f"Video with id {id} does not exist. Create a record first.")
    # update_data = video.model_dump(exclude_unset=True, exclude=["id"])
    rec.update(video)
    db.commit()
    db.flush()
    return rec.first()
