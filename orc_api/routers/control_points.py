"""Router for control points, in memory only."""

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile
from pyorc.cli.cli_utils import read_shape_as_gdf

from orc_api.schemas.control_points import ControlPointSet

router: APIRouter = APIRouter(prefix="/control_points", tags=["control_points"])


@router.post("/from_geojson/", response_model=ControlPointSet, status_code=201)
async def upload_gcps_geojson(
    file: UploadFile,
):
    """Read a gcp point file from geojson and return gcp details to the front end in-memory.

    This does not store data in the database.
    """
    try:
        gdf, _ = read_shape_as_gdf(fn=file.file)
        # figure out if crs is an EPSG
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a properly formatted JSON file with only points")
    # convert all  features into gcp instances
    try:
        gcps = ControlPointSet.from_gdf(gdf=gdf)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return gcps


@router.post("/from_csv/", response_model=ControlPointSet, status_code=201)
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
            gcps = ControlPointSet.from_df(df)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        return gcps
    else:
        raise HTTPException(status_code=400, detail='.CSV file does not contain required columns named "x", "y", "z"')
