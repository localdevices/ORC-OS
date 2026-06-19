"""CRUD operations for the Device model."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get(db: Session):
    """Get the device configuration. There should always be one device."""
    # there should always only be one device. Hence retrieve the first.
    return db.query(models.Device).first()


def update(db: Session, device: models.Device):
    """Update the device configuration."""
    db.query(models.Device).update(device.dict())
    db.commit()
    return db.query(models.Device).first()
