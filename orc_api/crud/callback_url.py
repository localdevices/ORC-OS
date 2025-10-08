"""CRUD operations for callback url."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get(db: Session):
    """Get the callback url."""
    # there should always only be one callback url. Hence retrieve the first.
    return db.query(models.CallbackUrl).first()


def add(db: Session, callback_url: models.CallbackUrl):
    """Add callback url to the database."""
    # Check if there is already a device
    existing_callback_url = get(db)

    if existing_callback_url:
        # delete existing
        delete(db)

    db.add(callback_url)
    db.commit()
    db.refresh(callback_url)
    return db.query(models.CallbackUrl).first()


def delete(db: Session):
    """Delete all callback urls."""
    db.query(models.CallbackUrl).delete()
    db.commit()


def update(db: Session, callback_url: dict):
    """Update a callback url record using a dict of potentially modified fields."""
    db.query(models.CallbackUrl).update(callback_url)
    db.commit()
    return db.query(models.CallbackUrl).first()
