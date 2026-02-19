"""Database models for custom systemd services."""

import enum
from typing import Optional

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from orc_api.db import Base


class ServiceType(enum.Enum):
    """Type of service execution."""

    ONE_TIME = 1
    TIMER = 2


class ParameterType(enum.Enum):
    """Data type of service parameters."""

    BOOLEAN = 1
    INTEGER = 2
    FLOAT = 3
    STRING = 4
    LITERAL = 5


class Service(Base):
    """Model for custom systemd services."""

    __tablename__ = "service"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_short_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    service_long_name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_type: Mapped[ServiceType] = mapped_column(
        Enum(ServiceType), nullable=False, default=ServiceType.ONE_TIME, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationship
    parameters: Mapped[list["ServiceParameter"]] = relationship(
        "ServiceParameter",
        back_populates="service",
        cascade="all, delete-orphan",  # if service is removed, all associated parameters are also removed
        lazy="selectin",
    )

    def __str__(self):
        return f"{self.id}: {self.service_long_name}"

    def __repr__(self):
        return f"Service({self.service_short_name})"


class ServiceParameter(Base):
    """Model for custom service parameters."""

    __tablename__ = "service_parameter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    service_id: Mapped[int] = mapped_column(Integer, ForeignKey("service.id"), nullable=False, index=True)
    parameter_short_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parameter_long_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parameter_type: Mapped[ParameterType] = mapped_column(Enum(ParameterType), nullable=False, index=True)
    default_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    nullable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationship
    service: Mapped[Service] = relationship("Service", back_populates="parameters")

    def __str__(self):
        return f"{self.parameter_short_name}: {self.parameter_long_name}"

    def __repr__(self):
        return f"ServiceParameter({self.parameter_short_name}, {self.parameter_type.value})"
