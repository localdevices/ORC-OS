from datetime import datetime
from nodeorc import db as models
from sqlalchemy import select
from sqlalchemy.sql.selectable import Select
from sqlalchemy.orm import Session
from typing import Optional, List

from nodeorc_api import schemas

def filter_start_stop(
    query: Select, start: Optional[datetime] = None, stop: Optional[datetime] = None
):
    if start:
        query = query.where(models.Video.timestamp >= start)
    if stop:
        query = query.where(models.Video.timestamp < stop)
    return query


def get_video(db: Session, id: int):
    return db.query(models.Video).filter(models.Video.id == id).first()


def list_videos(db: Session, start: Optional[datetime] = None, stop: Optional[datetime] = None) -> List[models.Video]:
    """List videos within time span of start and stop."""
    query = db.query(models.Video)
    query = filter_start_stop(query, start, stop)
    return query.all()
    

def delete_video(db: Session, id: int):
    """Delete a single video."""
    query = db.query(models.Video).filter(models.Video.id == id)
    if query.count() == 0:
        raise ValueError(f"Video with id {id} does not exist.")
    query.delete()
    db.commit()
    return

def create_video(db: Session, video: schemas.VideoCreate) -> models.Video:
    """Add a video to the database."""
    db_video: models.Video = models.Video.from_schema(video)
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video

def stream_video(db: Session, id: int):
    """Return video stream for a single video."""
    pass