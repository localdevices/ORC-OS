"""Pydantic models for control points."""

from typing import Optional

from pydantic import BaseModel


# Pydantic model for responses
class ControlPoint(BaseModel):
    """Base model for a cross-section."""

    x: float
    y: float
    z: float
    crs: Optional[str]
