from sqlalchemy.orm import Session
from nodeorc import db as models

def list(db: Session):
    # retrieve all
    return db.query(models.CameraConfig).all()

def get(db: Session, id: int):
    # get one by id
    return db.query(models.CameraConfig).where(models.CameraConfig == id).first()
