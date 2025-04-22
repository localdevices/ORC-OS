from sqlalchemy.orm import Session
from orc_api import db as models

def get(db: Session):
    # there should always only be one disk management config. Hence retrieve the first.
    dms = db.query(models.DiskManagement)
    if dms.count() > 0:
        return dms.first()
