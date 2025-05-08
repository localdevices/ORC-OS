"""Recipe routers."""

import io
from typing import List

import yaml
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pyorc.cli.cli_utils import validate_recipe
from sqlalchemy.orm import Session

# Directory to save uploaded files
from orc_api import crud
from orc_api.database import get_db
from orc_api.db import Recipe
from orc_api.schemas.recipe import RecipeRemote, RecipeResponse, RecipeUpdate

router: APIRouter = APIRouter(prefix="/recipe", tags=["recipe"])


@router.delete("/{id}/", status_code=204, response_model=None)
async def delete_recipe(id: int, db: Session = Depends(get_db)):
    """Delete a recipe."""
    _ = crud.recipe.delete(db=db, id=id)
    return


@router.get("/", response_model=List[RecipeResponse], status_code=200)
async def get_list_recipe(db: Session = Depends(get_db)):
    """Retrieve full list of recipes."""
    list_recipes = crud.recipe.list(db)
    return list_recipes


@router.get("/{id}/", response_model=RecipeResponse, status_code=200)
async def get_recipe(id: int, db: Session = Depends(get_db)):
    """Retrieve a recipe."""
    recipe = crud.recipe.get(db=db, id=id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    return recipe


@router.get("/{id}/download/", response_model=RecipeResponse, status_code=200)
async def download_recipe(id: int, db: Session = Depends(get_db)):
    """Download a recipe from the database into a .yaml file."""
    recipe = crud.recipe.get(db=db, id=id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found.")

    # Convert recipe data into a YAML string
    yaml_data = yaml.dump(recipe.data, default_flow_style=False, sort_keys=False)
    # set up file content
    yaml_file = io.BytesIO(yaml_data.encode("utf-8"))
    yaml_file.seek(0)

    # Return file response
    return StreamingResponse(
        yaml_file,
        media_type="application/x-yaml",
        headers={"Content-Disposition": f"attachment; filename=recipe_{id}.yaml"},
    )


@router.patch("/{id}/", status_code=200, response_model=RecipeResponse)
async def patch_recipe(id: int, recipe: RecipeRemote, db: Session = Depends(get_db)):
    """Update a recipe in the database."""
    update_recipe = recipe.model_dump(
        exclude_none=True, exclude={"id", "start_frame", "end_frame", "freq", "resolution", "velocimetry"}
    )
    recipe = crud.recipe.update(db=db, id=id, recipe=update_recipe)
    return recipe


@router.post("/empty/", response_model=RecipeResponse, status_code=200)
async def empty_recipe():
    """Create an empty recipe in-memory."""
    # return an empty response for now
    recipe = RecipeResponse()
    return recipe


@router.post("/", response_model=RecipeResponse, status_code=201)
async def create_recipe(recipe: RecipeResponse, db: Session = Depends(get_db)):
    """Create a new recipe and store it in the database."""
    # exclude fields that are already in the dict structure of the recipe
    recipe_ready_for_db = RecipeRemote(**recipe.model_dump())
    new_recipe_rec = Recipe(**recipe_ready_for_db.model_dump(exclude_none=True, exclude={"id"}))
    #     **recipe.model_dump(
    #         exclude_none=True, exclude={"id", "start_frame", "end_frame", "freq", "resolution", "velocimetry"}
    #     )
    # )
    recipe_rec = crud.recipe.add(db=db, recipe=new_recipe_rec)
    return recipe_rec


@router.post("/update/", response_model=RecipeUpdate, status_code=201)
async def update_recipe(recipe: RecipeUpdate):
    """Update an in-memory recipe.

    This only validates the input and adds default fields where necessary.
    No storage on the database is performed.
    """
    return recipe


@router.post("/from_file/", response_model=RecipeResponse, status_code=201)
async def upload_recipe(
    file: UploadFile,
):
    """Read a recipe file and return recipe details to the front end in-memory.

    This does not store data in the database.
    """
    recipe_body = file.file.read()
    recipe = yaml.load(recipe_body, Loader=yaml.FullLoader)
    try:
        recipe = validate_recipe(recipe)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RecipeResponse(data=recipe)
