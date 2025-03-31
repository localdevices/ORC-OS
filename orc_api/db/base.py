"""Base model for all models."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer
from sqlalchemy.orm import Mapped, declarative_base, mapped_column

# database set up
Base = declarative_base()


class SyncStatus(enum.Enum):
    """Status of video as Enum."""

    LOCAL = 1
    SYNCED = 2
    UPDATED = 3


class RemoteBase(Base):
    """Base class for all models that can have remote neighbours."""

    __abstract__ = True
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now())
    remote_id: Mapped[int] = mapped_column(Integer, nullable=True, unique=True)
    sync_status: Mapped[enum.Enum] = mapped_column(Enum(SyncStatus), nullable=True, default=SyncStatus.LOCAL)
