"""Router for control points, in memory only."""

import json
from typing import List

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile
from pyorc.cli.cli_utils import read_shape_as_gdf

from orc_api.schemas.control_points import ControlPoint

router: APIRouter = APIRouter(prefix="/control_points", tags=["control_points"])


@router.post("/from_geojson/", response_model=List[ControlPoint], status_code=201)
async def upload_gcps_geojson(
    file: UploadFile,
):
    """Read a gcp point file from geojson and return gcp details to the front end in-memory.

    This does not store data in the database.
    """
    gcps_body = file.file.read()
    try:
        gcps_dict = json.loads(gcps_body)
        gdf, crs = read_shape_as_gdf(geojson=gcps_dict)
        # figure out if crs is an EPSG
        if crs.to_epsg():
            crs_serialized = crs.to_epsg()
        else:
            crs_serialized = crs.to_wkt()
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a properly formatted JSON file with only points")
    # convert all  features into gcp instances
    try:
        gcps = [
            ControlPoint(x=gcp.geometry.x, y=gcp.geometry.y, z=gcp.geometry.z, crs=crs_serialized)
            for gcp in gdf.items()
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return gcps


@router.post("/from_csv/", response_model=List[ControlPoint], status_code=201)
async def upload_cs_csv(
    file: UploadFile,
):
    """Read a gcp point file as CSV and return gcp details to the front end in-memory.

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
        try:
            # this should never go wrong, but in case it does, we still have an error message
            gcps = [ControlPoint(x=gcp["x"], y=gcp["y"], z=gcp["z"], crs=None) for (n, gcp) in df.items()]
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        return gcps
    else:
        raise HTTPException(status_code=400, detail='.CSV file does not contain required columns named "x", "y", "z"')
