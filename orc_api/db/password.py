"""Database model for password storage."""

from sqlalchemy import Column, Integer, String

from orc_api.db import Base


class Password(Base):
    """Password table."""

    __tablename__ = "passwords"
    id = Column(Integer, primary_key=True, index=True)
    hashed_password = Column(String, nullable=False)
