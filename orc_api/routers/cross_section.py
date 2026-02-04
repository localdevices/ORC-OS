"""Recipe routers."""

import io
import json
from typing import List

import geopandas as gpd
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pyorc.api.cross_section import _fit_line
from shapely.geometry import Point
from sqlalchemy.orm import Session

# Directory to save uploaded files
from orc_api import crud
from orc_api.database import get_db
from orc_api.db import CrossSection
from orc_api.schemas.camera_config import CameraConfigResponse, CameraConfigUpdate
from orc_api.schemas.cross_section import (
    CrossSectionCreate,
    CrossSectionResponse,
    CrossSectionResponseCameraConfig,
    CrossSectionUpdate,
)

router: APIRouter = APIRouter(prefix="/cross_section", tags=["cross_section"])


def get_record(db: Session, id: int):
    """Retrieve a cross section record from the database."""
    cs = crud.cross_section.get(db=db, id=id)
    if not cs:
        raise HTTPException(status_code=404, detail="Cross section not found.")
    return cs


def linearize_points(gdf):
    """Straighten points in GeoDataFrame along average line with nearest snapping."""
    centroid, direction, angle = _fit_line(gdf.geometry.x, gdf.geometry.y)
    # Project each point onto the line closest-distance
    coords = np.column_stack([gdf.geometry.x, gdf.geometry.y])
    coords_centered = coords - centroid

    # Project onto the line direction
    projections = np.dot(coords_centered, direction)

    # Calculate new coordinates on the line
    new_x = centroid[0] + projections * direction[0]
    new_y = centroid[1] + projections * direction[1]
    new_geometries = [Point(_x, _y, _z) for _x, _y, _z in zip(new_x, new_y, gdf.geometry.z)]
    # Create new geometries with Z preserved
    gdf.geometry = new_geometries
    return gdf


@router.delete("/{id}/", status_code=204, response_model=None)
async def delete_cs(id: int, db: Session = Depends(get_db)):
    """Delete a cross section."""
    _ = crud.cross_section.delete(db=db, id=id)
    return


@router.get("/", response_model=List[CrossSectionResponse], status_code=200)
async def get_list_cs(db: Session = Depends(get_db)):
    """Retrieve full list of recipes."""
    list_css = crud.cross_section.list(db)
    return list_css


@router.get("/{id}/", response_model=CrossSectionResponse, status_code=200)
async def get_cs(id: int, db: Session = Depends(get_db)):
    """Retrieve a cross section."""
    return get_record(db, id)


@router.get("/{id}/download/", response_model=CrossSectionResponse, status_code=200)
async def download_cs(id: int, db: Session = Depends(get_db)):
    """Download a recipe from the database into a .yaml file."""
    cs = get_record(db, id)
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


@router.get("/{id}/wetted_surface/", response_model=List[List[float]], status_code=200)
async def get_wetted_surface(
    id: int, db: Session = Depends(get_db), camera_config_id: int = None, h: float = 0.0, camera: bool = True
):
    """Return wetted surface at a given height in serializable coordinates."""
    if camera_config_id is None:
        raise HTTPException(
            status_code=400, detail="Camera configuration ID must be provided with parameter camera_config_id."
        )
    cs = CrossSectionResponseCameraConfig.model_validate(get_record(db, id))
    cc_rec = crud.camera_config.get(db, camera_config_id)
    if cc_rec is None:
        raise HTTPException(status_code=404, detail="Camera configuration not found.")
    camera_config = CameraConfigResponse.model_validate(cc_rec)
    cs.camera_config = camera_config
    # get wetted surface from pyorc cross section object
    return cs.get_wetted_surface(h=h, camera=camera)


@router.get("/{id}/csl_water_lines/", response_model=List[List[List[float]]], status_code=200)
async def get_csl_line(
    id: int,
    db: Session = Depends(get_db),
    camera_config_id: int = None,
    h: float = 0.0,
    length: float = 1.0,
    offset: float = 0.0,
    camera: bool = True,
):
    """Return wetted surface at a given height in serializable coordinates."""
    if camera_config_id is None:
        raise HTTPException(
            status_code=400, detail="Camera configuration ID must be provided with parameter camera_config_id."
        )
    cs = CrossSectionResponseCameraConfig.model_validate(get_record(db, id))
    cc_rec = crud.camera_config.get(db, camera_config_id)
    if cc_rec is None:
        raise HTTPException(status_code=404, detail="Camera configuration not found.")
    camera_config = CameraConfigResponse.model_validate(cc_rec)
    cs.camera_config = camera_config

    # get wetted surface from pyorc cross section object
    try:
        lines = cs.get_csl_line(h=h, length=length, offset=offset, camera=camera)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return lines


@router.patch("/{id}/", status_code=200, response_model=CrossSectionResponse)
async def patch_cs(id: int, cs: CrossSectionUpdate, db: Session = Depends(get_db)):
    """Update a cross section in the database."""
    update_cs = cs.model_dump(exclude_none=True, exclude={"id", "x", "y", "z", "s"})
    cs = crud.cross_section.update(db=db, id=id, cross_section=update_cs)
    return cs


@router.post("/{id}/camera_config/", response_model=CrossSectionResponseCameraConfig, status_code=200)
async def get_cs_cam_config(id: int, camera_config: CameraConfigUpdate, db: Session = Depends(get_db)):
    """Retrieve a cross section with attempt to fill camera view coordinates using a provided camera configuration."""
    cs = crud.cross_section.get(db=db, id=id)
    if not cs:
        raise HTTPException(status_code=404, detail="Cross section not found.")
    try:
        cs_response = CrossSectionResponseCameraConfig(
            id=cs.id,
            created_at=cs.created_at,
            remote_id=cs.remote_id,
            sync_status=cs.sync_status,
            name=cs.name,
            features=cs.features,
            camera_config=camera_config,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e).split(", ")[1])
    return cs_response


@router.post("/", response_model=CrossSectionResponse, status_code=201)
async def create_cs(cs: CrossSectionCreate, db: Session = Depends(get_db)):
    """Create a new cross-section and store it in the database."""
    # exclude fields that are already in the dict structure of the cross-section
    new_cs = CrossSection(**cs.model_dump(exclude_none=True, exclude={"id", "x", "y", "z", "s"}))
    cs = crud.cross_section.add(db=db, cross_section=new_cs)
    return cs


@router.post("/update/", response_model=CrossSectionUpdate, status_code=201)
async def update_cs(cs: CrossSectionUpdate):
    """Update an in-memory cross-section.

    This only validates the input and adds default fields where necessary.
    No storage on the database is performed.
    """
    return cs


@router.post("/from_geojson/", response_model=CrossSectionCreate, status_code=201)
async def upload_cs_geojson(file: UploadFile, linearize: bool = Form(False)):
    """Read a cross section file and return cross-section details to the front end in-memory.

    This does not store data in the database.
    """
    cs_body = file.file.read()
    try:
        cs = json.loads(cs_body)
        if "crs" in cs:
            crs = cs["crs"]
        else:
            crs = None
        # extract crs
        file.file.seek(0)
        gdf = gpd.read_file(file.file)
        # gpd parses a random CRS on a gdf if no crs is given in shapefile. If crs is None, also set gdf.crs to None
        if crs is None:
            gdf.set_crs(None, allow_override=True)
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a properly formatted JSON file")
    try:
        if linearize:
            gdf = linearize_points(gdf)
        cs = json.loads(gdf.to_json())
        if crs is not None:
            # add the crs, this gets lost in translation
            cs["crs"] = crs
        else:
            cs.pop("crs")
        cs = CrossSectionCreate(features=cs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cs


@router.post("/from_csv/", response_model=CrossSectionCreate, status_code=201)
async def upload_cs_csv(
    file: UploadFile,
    linearize: bool = False,
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
    if expected_keys.issubset([k.lower() for k in df.keys()]):
        # parse to gdf
        geometry = gpd.points_from_xy(df["x"], df["y"], df["z"])
        gdf = gpd.GeoDataFrame(df, geometry=geometry)
        if linearize:
            gdf = linearize_points(gdf)
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
