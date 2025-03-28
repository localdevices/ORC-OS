"""CRUD operations for recipes."""

from sqlalchemy.orm import Session

from orc_api import db as models


def get(db: Session, id: int):
    """Get a single video."""
    query = db.query(models.Recipe).filter(models.Recipe.id == id)
    if query.count() == 0:
        return
    return query.first()


def add(db: Session, recipe: models.Recipe) -> models.Recipe:
    """Add a recipe to the database."""
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe
