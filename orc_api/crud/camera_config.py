"""Camera config CRUD operations."""

from sqlalchemy.orm import Session

from orc_api import db as models


def add(db: Session, camera_config: models.CameraConfig) -> models.CameraConfig:
    """Add a recipe to the database."""
    db.add(camera_config)
    db.commit()
    db.refresh(camera_config)
    return camera_config


def get_query_by_id(db: Session, id: int):
    """Get a single time series record by id."""
    return db.query(models.CameraConfig).filter(models.CameraConfig.id == id)


def get(db: Session, id: int):
    """Get a single camera config record by id."""
    # get one by id
    query = get_query_by_id(db=db, id=id)
    if query.count() == 0:
        return
    return query.first()


def list(db: Session):
    """Get a list of camera configs."""
    # retrieve all
    return db.query(models.CameraConfig).all()


def update(db: Session, id: int, camera_config: dict):
    """Update a camera config record using a dict of potentially modified fields."""
    rec = get_query_by_id(db=db, id=id)
    if not rec.first():
        raise ValueError(f"Camera config with id {id} does not exist. Create a record first.")
    # update_data = time_series.model_dump(exclude_unset=True, exclude=["id"])
    rec.update(camera_config)
    db.commit()
    db.flush()
    return rec.first()


def delete(db: Session, id: int):
    """Delete a single video."""
    query = db.query(models.Recipe).filter(models.Recipe.id == id)
    if query.count() == 0:
        raise ValueError(f"Recipe with id {id} does not exist.")
    recipe = query.first()
    db.delete(recipe)
    db.commit()
    return
