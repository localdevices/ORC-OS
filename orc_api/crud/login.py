"""CRUD operations for password."""

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from orc_api import db as models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get(db: Session):
    """Get the hashed password."""
    pw_query = db.query(models.Password)
    if pw_query.count() > 0:
        return pw_query.first()


def create(db: Session, new_password: str):
    """Create a new hashed password from user password."""
    hashed = pwd_context.hash(new_password)
    password_entry = models.Password(hashed_password=hashed)
    db.add(password_entry)
    db.commit()


def update(db: Session, new_password: str):
    """Update the hashed password if a password already exists."""
    hashed = pwd_context.hash(new_password)
    password_entry = get(db)
    if password_entry:
        password_entry.hashed_password = hashed
        db.commit()


def verify(db: Session, plain_password: str):
    """Verify the password through hashing algorithm."""
    password_entry = get(db)
    if password_entry:
        return pwd_context.verify(plain_password, password_entry.hashed_password)
    return False
