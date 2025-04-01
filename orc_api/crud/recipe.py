"""CRUD operations for recipes."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get_query_by_id(db: Session, id: int):
    """Get a single time series record by id."""
    return db.query(models.Recipe).filter(models.Recipe.id == id)


def get(db: Session, id: int):
    """Get a single video."""
    query = get_query_by_id(db=db, id=id)
    if query.count() == 0:
        return
    return query.first()


def add(db: Session, recipe: models.Recipe) -> models.Recipe:
    """Add a recipe to the database."""
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


def update(db: Session, id: int, recipe: dict):
    """Update a cross-section record using a dict of potentially modified fields."""
    rec = get_query_by_id(db=db, id=id)
    if not rec.first():
        raise ValueError(f"Time series with id {id} does not exist. Create a record first.")
    # update_data = time_series.model_dump(exclude_unset=True, exclude=["id"])
    rec.update(recipe)
    db.commit()
    db.flush()
    return rec.first()
