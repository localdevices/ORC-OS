from sqlalchemy.orm import Session
from orc_api import db as models

def get(db: Session):
    # there should always only be one device. Hence retrieve the first.
    wls = db.query(models.WaterLevelSettings)
    if wls.count() > 0:
        return wls.first()


def update(db: Session, water_level_settings: models.WaterLevelSettings):
    db.query(models.WaterLevelSettings).update(water_level_settings.dict())
    db.commit()
    return db.query(models.WaterLevelSettings).first()