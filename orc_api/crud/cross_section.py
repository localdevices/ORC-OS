"""CRUD operations for cross-sections."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get(db: Session, id: int):
    """Get a single video."""
    query = db.query(models.CrossSection).filter(models.CrossSection.id == id)
    if query.count() == 0:
        return
    return query.first()


def add(db: Session, cross_section: models.CrossSection) -> models.CrossSection:
    """Add a cross-section to the database."""
    db.add(cross_section)
    db.commit()
    db.refresh(cross_section)
    return cross_section
