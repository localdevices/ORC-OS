"""Pydantic models for recipes."""

from pydantic import BaseModel, ConfigDict, Field

from orc_api import crud
from orc_api.database import get_session
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

    def sync_remote(self, institute: int):
        """Send the recipe to LiveORC API.

        Recipes belong to an institute, hence also the institute ID is required.
        """
        endpoint = "/api/recipe/"
        data = {
            "name": self.name,
            "data": self.data,
            "institute": institute,
        }
        # sync remotely with the updated data, following the LiveORC end point naming
        response_data = super().sync_remote(endpoint=endpoint, json=data)
        if response_data is not None:
            # patch the record in the database, where necessary
            # update schema instance
            update_recipe = RecipeResponse.model_validate(response_data)
            r = crud.recipe.update(get_session(), id=self.id, recipe=update_recipe.model_dump(exclude_unset=True))
            return RecipeResponse.model_validate(r)
