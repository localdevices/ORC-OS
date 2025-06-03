"""Router for control points, in memory only."""

from typing import List

import pandas as pd
import pyorc
import pyorc.helpers
from fastapi import APIRouter, Body, HTTPException, UploadFile
from pyorc import cv
from pyorc.cli.cli_utils import get_gcps_optimized_fit, read_shape_as_gdf
from pyproj import CRS

from orc_api.schemas.control_points import ControlPointSet, FittedPoints

router: APIRouter = APIRouter(prefix="/control_points", tags=["control_points"])


def get_nearest_utm_projection(coordinates: List[List[float]]) -> CRS:
    """Get nearest UTM zone from list of coordinates."""
    if not coordinates:
        raise ValueError("No coordinates provided.")

    # Compute the average longitude and latitude
    avg_longitude = sum(point[0] for point in coordinates) / len(coordinates)
    avg_latitude = sum(point[1] for point in coordinates) / len(coordinates)

    # Determine the UTM zone based on the average coordinates
    utm_zone = int((avg_longitude + 180) / 6) + 1
    is_northern = avg_latitude >= 0

    # Generate the CRS for the UTM zone
    return CRS(proj="utm", zone=utm_zone, ellps="WGS84", south=not is_northern)


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


@router.post(
    "/fit_perspective", response_model=None, description="Fit perspective parameters on source and target points"
)
async def fit_perspective(
    gcps: ControlPointSet = Body(..., description="src as [column, row], dst as [x, y, z] and crs"),
    height: int = Body(..., description="height of the video"),
    width: int = Body(..., description="width of the video"),
):
    """Fit perspective parameters on source and target points."""
    src, dst = gcps.parse()
    crs = gcps.crs
    if crs:
        try:
            crs = CRS.from_user_input(crs)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CRS: {e}")
        if not crs.is_projected:
            if crs.to_epsg() == 4326:
                # Find the nearest UTM zone of the src coordinates using the helper function
                crs_to = get_nearest_utm_projection(dst)
                # TODO: convert dst to nearest UTM projection
                dst = pyorc.helpers.xyz_transform(dst, crs, crs_to)
            else:
                raise HTTPException(status_code=400, detail="Only lat lon is supported if CRS is geographic")

    # understand if points are sufficient and equal in length
    if len(src) != len(dst):
        raise HTTPException(status_code=400, detail="The number of source and destination points must be the same")

    if len(src) < 6:
        raise HTTPException(status_code=400, detail="The number of control points must be at least 6")
    # TODO: also allow a 4-point or 2-point nadir solution
    # Example response (you can customize this behavior)
    try:
        src_est, dst_est, camera_matrix, dist_coeffs, rvec, tvec, error = get_gcps_optimized_fit(
            src, dst, height, width
        )
        # reverse rvec and tvec
        camera_rotation, camera_position = cv.pose_world_to_camera(rvec, tvec)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Perspective constraints failed: {str(e)}")
    return FittedPoints(
        src_est=src_est,
        dst_est=dst_est,
        f=camera_matrix[0][0],
        k1=dist_coeffs[0][0],
        k2=dist_coeffs[1][0],
        camera_position=camera_position,
        camera_rotation=camera_rotation,
        error=error,
    )
