from datetime import datetime
from nodeorc import db as models
from sqlalchemy import select
from sqlalchemy.sql.selectable import Select
from sqlalchemy.orm import Session
from typing import Optional, List

# from nodeorc_api import schemas

def filter_start_stop(
    query: Select, start: Optional[datetime] = None, stop: Optional[datetime] = None
):
    if start:
        query = query.where(models.Video.timestamp >= start)
    if stop:
        query = query.where(models.Video.timestamp < stop)
    return query.order_by(models.Video.timestamp)


def get(db: Session, id: int):
    query = db.query(models.Video).filter(models.Video.id == id)
    if query.count() == 0:
        return
    return query.first()

def get_ids(db: Session, ids: List[int] = []) -> List[models.Video]:
    """List videos from provided ids."""
    query = db.query(models.Video).filter(models.Video.id.in_(ids))
    return query.all()

def get_list(db: Session, start: Optional[datetime] = None, stop: Optional[datetime] = None) -> List[models.Video]:
    """List videos within time span of start and stop."""
    query = db.query(models.Video)
    query = filter_start_stop(query, start, stop)
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

def create(db: Session, video: models.Video) -> models.Video:
    """Add a video to the database."""
    db.add(video)
    db.commit()
    db.refresh(video)
    return video
