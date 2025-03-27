from sqlalchemy.orm import Session
from orc_api import db as models


def get(db: Session):
    # there should always only be one callback url. Hence retrieve the first.
    return db.query(models.CallbackUrl).first()


def add(db: Session, callback_url: models.CallbackUrl):
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
    db.query(models.CallbackUrl).delete()
    db.commit()