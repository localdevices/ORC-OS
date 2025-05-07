"""CRUD operations for video configs."""

from typing import List

from sqlalchemy.orm import Session

from orc_api import db as models


def get_query_by_id(db: Session, id: int):
    """Get a single video config in a query (e.g. for updating."""
    return db.query(models.VideoConfig).filter(models.VideoConfig.id == id)


def get(db: Session, id: int):
    """Get a single video config."""
    query = get_query_by_id(db=db, id=id)
    if query.count() == 0:
        return
    return query.first()


def get_list(db: Session) -> List[models.Video]:
    """List video configs within time span of start and stop."""
    query = db.query(models.VideoConfig)
    return query.all()


def delete(db: Session, id: int):
    """Delete a single video."""
    query = db.query(models.VideoConfig).filter(models.VideoConfig.id == id)
    if query.count() == 0:
        raise ValueError(f"Video with id {id} does not exist.")
    video_config = query.first()
    db.delete(video_config)
    db.commit()
    return


def add(db: Session, video_config: models.VideoConfig) -> models.VideoConfig:
    """Add a video config to the database."""
    db.add(video_config)
    db.commit()
    db.refresh(video_config)
    return video_config


def update(db: Session, id: int, video_config: dict):
    """Update a video record using the VideoResponse instance."""
    rec = get_query_by_id(db=db, id=id)
    if not rec.first():
        raise ValueError(f"Video config with id {id} does not exist. Create a record first.")
    rec.update(video_config)
    db.commit()
    db.flush()
    return rec.first()
