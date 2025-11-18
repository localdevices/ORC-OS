"""Model for callback url."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from orc_api.db import Base


class CallbackUrl(Base):
    """Model for callback url."""

    __tablename__ = "callback_url"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now())
    url: Mapped[str] = mapped_column(
        String,
        default="https://127.0.0.1:8000/api",
        nullable=False,
        comment="url to api main end point of server to report to",
    )
    remote_site_id: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
        comment="Remote site id to sent data to. Needed in order to send data belonging to site to end point.",
    )
    retry_timeout: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
        comment="Maximum time to repeatedly try requests to api. If set to zero, only one try will be attempted.",
    )
    token_refresh_end_point: Mapped[str] = mapped_column(
        String, comment="Refresh end point for JWT tokens of the server", default="/api/token/refresh/"
    )
    token_refresh: Mapped[str] = mapped_column(
        String,
        comment="Refresh JWT token",
        nullable=True,
    )
    token_access: Mapped[str] = mapped_column(
        String,
        comment="JWT token",
        nullable=True,
    )
    token_expiration: Mapped[datetime] = mapped_column(
        DateTime,
        comment="Date time of moment of expiry of refresh token",
        nullable=True,
    )

    def __str__(self):
        return "CallbackUrl {} ({})".format(self.created_at, self.id)

    def __repr__(self):
        return "{}".format(self.__str__())

    # @property
    # def pydantic(self):
    #     rec = sqlalchemy_to_dict(self)
    #     return models.CallbackUrl(**rec)
