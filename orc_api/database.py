"""Database connection and session management."""

from .db import Session


# Dependency to get the DB session
def get_db():
    """Get db session generator."""
    db = Session()
    try:
        yield db
    finally:
        db.close()


def get_session():
    """Get db session."""
    return Session()
