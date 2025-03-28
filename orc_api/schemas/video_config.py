"""Pydantic schema for VideoConfig validation."""

from typing import Optional

from pydantic import BaseModel, Field, conlist

from orc_api.schemas.camera_config import CameraConfigBase
from orc_api.schemas.cross_section import CrossSectionBase
from orc_api.schemas.recipe import RecipeBase


class VideoConfigBase(BaseModel):
    """Pydantic schema for VideoConfig validation."""

    id: int = Field(..., description="Primary key representing the video configuration.")
    camera_config_id: int = Field(..., description="Foreign key to the camera configuration.", ge=1)
    recipe_id: int = Field(..., description="Foreign key to the recipe.", ge=1)
    cross_section_id: Optional[int] = Field(None, description="Optional foreign key to the cross section.", ge=1)
    rvec: conlist(float, min_items=3, max_items=3) = Field(
        ..., description="Rotation vector for matching CrossSection with CameraConfig."
    )
    tvec: conlist(float, min_items=3, max_items=3) = Field(
        ..., description="Translation vector for matching CrossSection with CameraConfig."
    )
    camera_config: Optional[CameraConfigBase] = Field(
        None, description="Associated CameraConfig object (if available)."
    )
    recipe: Optional[RecipeBase] = Field(None, description="Associated Recipe object (if available).")

    cross_section: Optional[CrossSectionBase] = Field(
        None, description="Associated CrossSection object (if available)."
    )
