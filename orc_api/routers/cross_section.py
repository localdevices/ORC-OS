"""Recipe routers."""

import io
import json
from typing import List

import geopandas as gpd
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# Directory to save uploaded files
from orc_api import crud
from orc_api.database import get_db
from orc_api.db import CrossSection
from orc_api.schemas.cross_section import CrossSectionCreate, CrossSectionResponse, CrossSectionUpdate

router: APIRouter = APIRouter(prefix="/cross_section", tags=["cross_section"])


@router.delete("/{id}/", status_code=204, response_model=None)
async def delete_cs(id: int, db: Session = Depends(get_db)):
    """Delete a recipe."""
    _ = crud.cross_section.delete(db=db, id=id)
    return


@router.get("/", response_model=List[CrossSectionResponse], status_code=200)
async def get_list_cs(db: Session = Depends(get_db)):
    """Retrieve full list of recipes."""
    list_css = crud.cross_section.list(db)
    return list_css


@router.get("/{id}/", response_model=CrossSectionResponse, status_code=200)
async def get_cs(id: int, db: Session = Depends(get_db)):
    """Retrieve a recipe."""
    cs = crud.cross_section.get(db=db, id=id)
    if not cs:
        raise HTTPException(status_code=404, detail="Cross section not found.")
    return cs


@router.get("/{id}/download/", response_model=CrossSectionResponse, status_code=200)
async def download_cs(id: int, db: Session = Depends(get_db)):
    """Download a recipe from the database into a .yaml file."""
    cs = crud.recipe.get(db=db, id=id)
    if not cs:
        raise HTTPException(status_code=404, detail="Recipe not found.")

    # Convert cross section data into a GeoJSON string
    json_data = json.dumps(cs.features, indent=4)
    # set up file content
    json_file = io.BytesIO(json_data.encode("utf-8"))
    json_file.seek(0)

    # Return file response
    return StreamingResponse(
        json_file,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=cross_section_{id}.geojson"},
    )


@router.patch("/{id}/", status_code=200, response_model=CrossSectionResponse)
async def patch_cs(id: int, cs: CrossSectionUpdate, db: Session = Depends(get_db)):
    """Update a cross section in the database."""
    update_cs = cs.model_dump(exclude_none=True, exclude={"id", "x", "y", "z", "s"})
    cs = crud.cross_section.update(db=db, id=id, cross_section=update_cs)
    return cs


@router.post("/", response_model=CrossSectionResponse, status_code=201)
async def create_cs(cs: CrossSectionCreate, db: Session = Depends(get_db)):
    """Create a new cross-section and store it in the database."""
    # exclude fields that are already in the dict structure of the cross-section
    print("CROSS SECTION")
    new_cs = CrossSection(**cs.model_dump(exclude_none=True, exclude={"id", "x", "y", "z", "s"}))
    print(new_cs)
    cs = crud.cross_section.add(db=db, cross_section=new_cs)
    return cs


@router.post("/update/", response_model=CrossSectionUpdate, status_code=201)
async def update_recipe(cs: CrossSectionUpdate):
    """Update an in-memory cross-section.

    This only validates the input and adds default fields where necessary.
    No storage on the database is performed.
    """
    return cs


@router.post("/from_geojson/", response_model=CrossSectionCreate, status_code=201)
async def upload_cs_geojson(
    file: UploadFile,
):
    """Read a recipe file and return cross-section details to the front end in-memory.

    This does not store data in the database.
    """
    cs_body = file.file.read()
    try:
        cs = json.loads(cs_body)
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a properly formatted JSON file")
    try:
        cs = CrossSectionCreate(features=cs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cs


@router.post("/from_csv/", response_model=CrossSectionCreate, status_code=201)
async def upload_cs_csv(
    file: UploadFile,
):
    """Read a recipe file and return cross-section details to the front end in-memory.

    This does not store data in the database.
    """
    try:
        df = pd.read_csv(file.file)
        # convert all keys to lower case
        df = df.rename(columns=str.lower)
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a properly formatted CSV file")
    # look for (lower) X, Y, Z
    expected_keys = {"x", "y", "z"}
    # Check if all strings exist in the list
    if expected_keys.issubset(df.keys()):
        # parse to gdf
        geometry = gpd.points_from_xy(df["x"], df["y"], df["z"])
        gdf = gpd.GeoDataFrame(df, geometry=geometry)
        # turn into json
        cs = json.loads(gdf.to_json())
        try:
            # this should never go wrong, but in case it does, we still have an error message
            cs = CrossSectionCreate(features=cs)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        return cs

    else:
        raise HTTPException(status_code=400, detail='.CSV file does not contain required columns named "x", "y", "z"')
