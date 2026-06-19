"""CRUD operations for disk management configuration."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get(db: Session):
    """Get the disk management configuration. There should always be one configuration."""
    # there should always only be one disk management config. Hence retrieve the first.
    settings = db.query(models.Settings)
    if settings.count() > 0:
        return settings.first()


def add(db: Session, settings: models.Settings):
    """Add a new disk management configuration."""
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
