"""CRUD operations for the water level settings."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get(db: Session):
    """Get the water level settings."""
    # Retrieve the first water level.
    wls = db.query(models.WaterLevelSettings)
    if wls.count() > 0:
        return wls.first()


def update(db: Session, water_level_settings: models.WaterLevelSettings):
    """Update the water level settings."""
    db.query(models.WaterLevelSettings).update(water_level_settings.dict())
    db.commit()
    return db.query(models.WaterLevelSettings).first()
