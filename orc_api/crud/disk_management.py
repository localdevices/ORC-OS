"""CRUD operations for disk management settings."""

from sqlalchemy.orm import Session

from orc_api.db import DiskManagement
from orc_api.schemas.disk_management import DiskManagementCreate


def get(db: Session):
    """Retrieve the disk management settings record from the database."""
    # there should always only be one disk management config. Hence retrieve the first.
    dms = db.query(DiskManagement)
    if dms.count() > 0:
        return dms.first()


def create_update(db: Session, disk_management: DiskManagementCreate):
    """Create or update the disk management settings record in the database."""
    # first delete if there is an existing config
    existing_dm = get(db)
    disk_management.frequency = max(disk_management.frequency, 600)  # enforce minimum frequency of 600s
    if existing_dm:
        # Update the existing record's fields
        for key, value in disk_management.model_dump(exclude_none=True).items():
            setattr(existing_dm, key, value)
        db.commit()
        db.refresh(existing_dm)  # Refresh to get the updated fields
        return existing_dm
    else:
        # Create a new device record if none exists
        new_dm = DiskManagement(**disk_management.model_dump(exclude_none=True, exclude={"id"}))
        db.add(new_dm)
        db.commit()
        db.refresh(new_dm)
        return new_dm
