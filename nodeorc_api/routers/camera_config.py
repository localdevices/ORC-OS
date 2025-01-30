import pyorc.helpers
from fastapi import APIRouter, Body, Depends, HTTPException
from nodeorc.db import Session, CameraConfig
from typing import List, Dict

from nodeorc_api.schemas.camera_config import CameraConfigCreate, CameraConfigResponse, GCPs, FittedPoints
from nodeorc_api.database import get_db
from nodeorc_api import crud
from pyorc.cli.cli_utils import get_gcps_optimized_fit
from pyorc.cv import solvepnp
from pyproj import CRS, Proj

router: APIRouter = APIRouter(prefix="/camera_config", tags=["camera_config"])

def get_nearest_utm_projection(coordinates: List[List[float]]) -> CRS:
    """Helper function to compute nearest UTM zone from list of coordinates."""
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


@router.get("/", response_model=List[CameraConfigResponse], description="Get all camera configurations")
async def list_camera_configs(db: Session = Depends(get_db)):
    camera_configs: List[CameraConfig] = crud.camera_config.list(db)
    return camera_configs

@router.get("/{camera_config_id}", response_model=CameraConfigResponse, description="Get camera configurations by ID")
async def get_camera_config_by_id(camera_config_id: int, db: Session = Depends(get_db)):
    camera_config: CameraConfig = crud.camera_config.get(db, camera_config_id)
    return camera_config


@router.post(
    "/fit_perspective", response_model=None,
    description="Fit perspective parameters on source and target points"
)
async def fit_perspective(gcps: GCPs = Body(
    ...,
    description="src as [column, row], dst as [x, y, z] and crs"
)):
    # Extract information from the request
    src = gcps.src
    dst = gcps.dst
    crs = gcps.crs
    height = gcps.height
    width = gcps.width
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

    # Example response (you can customize this behavior)
    try:
        src_est, dst_est, camera_matrix, dist_coeffs, rvec, tvec, error = get_gcps_optimized_fit(src, dst, height, width)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Perspective constraints failed: {str(e)}")
    return FittedPoints(
        src_est=src_est,
        dst_est=dst_est,
        camera_matrix=camera_matrix,
        dist_coeffs=dist_coeffs,
        rvec=rvec,
        tvec=tvec,
        error=error
    )


@router.post("/", response_model=CameraConfigResponse, status_code=201, description="Post a new complete Camera Configuration")
async def post_camera_config(camera_config: CameraConfigCreate, db: Session = Depends(get_db)):
    """Post a new camera configuration."""
    # Create a new device record if none exists
    new_camera_config = CameraConfig(**camera_config.model_dump(exclude_none=True, exclude={"id"}))
    db.add(new_camera_config)
    db.commit()
    db.refresh(new_camera_config)
    return new_camera_config

