from sqlalchemy.orm import Session

from orc_api.db import Recipe
from orc_api.schemas.recipe import RecipeResponse


def test_recipe_schema(session_recipe: Session):
    # retrieve recipe
    r_rec = session_recipe.query(Recipe).first()
    r = RecipeResponse.model_validate(r_rec)
    assert r.id == 1
    assert r.name == "some recipe"
    assert "video" in r.data
