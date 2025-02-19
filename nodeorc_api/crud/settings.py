from sqlalchemy.orm import Session
from nodeorc import db as models

def get(db: Session):
    # there should always only be one disk management config. Hence retrieve the first.
    settings = db.query(models.Settings)
    if settings.count() > 0:
        return settings.first()

def add(db: Session, settings: models.Settings):
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
