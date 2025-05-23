"""CRUD operations for cross-sections."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get_query_by_id(db: Session, id: int):
    """Get a single time series record by id."""
    return db.query(models.CrossSection).filter(models.CrossSection.id == id)


def get(db: Session, id: int):
    """Get a single video."""
    query = get_query_by_id(db=db, id=id)
    if query.count() == 0:
        return
    return query.first()


def list(db: Session):
    """Get a list of recipes."""
    return db.query(models.CrossSection).all()


def add(db: Session, cross_section: models.CrossSection) -> models.CrossSection:
    """Add a cross-section to the database."""
    db.add(cross_section)
    db.commit()
    db.refresh(cross_section)
    return cross_section


def delete(db: Session, id: int):
    """Delete a single recipe."""
    query = db.query(models.CrossSection).filter(models.CrossSection.id == id)
    if query.count() == 0:
        raise ValueError(f"Cross Section with id {id} does not exist.")
    recipe = query.first()
    db.delete(recipe)
    db.commit()
    return


def update(db: Session, id: int, cross_section: dict):
    """Update a cross-section record using a dict of potentially modified fields."""
    rec = get_query_by_id(db=db, id=id)
    if not rec.first():
        raise ValueError(f"Time series with id {id} does not exist. Create a record first.")
    # update_data = time_series.model_dump(exclude_unset=True, exclude=["id"])
    rec.update(cross_section)
    db.commit()
    db.flush()
    return rec.first()
