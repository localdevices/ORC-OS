"""Pydantic models for recipes."""

from pydantic import BaseModel, ConfigDict, Field

from orc_api.schemas.base import RemoteModel


# Pydantic model for responses
class RecipeBase(BaseModel):
    """Base model for a recipe."""

    name: str = Field(default=None, description="Free recognizable description of cross section.")
    data: dict = Field(description="Recipe data")
    model_config = ConfigDict(from_attributes=True)


class RecipeResponse(RecipeBase, RemoteModel):
    """Response model for a recipe."""

    id: int = Field(description="Recipe ID")
