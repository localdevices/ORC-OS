from sqlalchemy.orm import Session
from nodeorc import db as models

def get(db: Session):
    # there should always only be one device. Hence retrieve the first.
    return db.query(models.Device).first()

def update(db: Session, device: models.Device):
    db.query(models.Device).update(device.dict())
    db.commit()
    return db.query(models.Device).first()