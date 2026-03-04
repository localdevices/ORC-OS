"""Database model for password storage."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from orc_api.db import Base


class Password(Base):
    """Password table."""

    __tablename__ = "passwords"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
