import json

from orc_api import crud
from orc_api.db.recipe import Recipe


def test_add_get_recipe(recipe, session_empty):
    recipe = json.loads(recipe)
    recipe_rec = Recipe(name="some recipe", data=recipe)
    recipe_rec = crud.recipe.add(session_empty, recipe_rec)
    assert recipe_rec.name == "some recipe"
    assert recipe_rec.id == 1
    assert recipe_rec.data == recipe
