"""CRUD operations for password."""

import bcrypt
from sqlalchemy.orm import Session

from orc_api import db as models


def get(db: Session):
    """Get the hashed password."""
    pw_query = db.query(models.Password)
    if pw_query.count() > 0:
        return pw_query.first()


def create(db: Session, new_password: str):
    """Create a new hashed password from user password."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(new_password.encode("utf-8"), salt)
    password_entry = models.Password(hashed_password=hashed.decode("utf-8"))
    db.add(password_entry)
    db.commit()


def update(db: Session, new_password: str):
    """Update the hashed password if a password already exists."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(new_password.encode("utf-8"), salt)
    password_entry = get(db)
    if password_entry:
        password_entry.hashed_password = hashed.decode("utf-8")
        db.commit()


def verify(db: Session, plain_password: str):
    """Verify the password through hashing algorithm."""
    password_entry = get(db)
    if password_entry:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_entry.hashed_password.encode("utf-8"))
    return False
