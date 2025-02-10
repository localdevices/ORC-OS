from sqlalchemy.orm import Session
from nodeorc import db as models

def get(db: Session):
    # there should always only be one callback url. Hence retrieve the first.
    return db.query(models.CallbackUrl).first()


def update(db: Session, callback_url: models.CallbackUrl):
    db.query(models.CallbackUrl).update(callback_url.dict())
    db.commit()
    return db.query(models.CallbackUrl).first()

def delete(db: Session):
    db.query(models.CallbackUrl).delete()