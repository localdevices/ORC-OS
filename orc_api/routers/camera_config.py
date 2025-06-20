"""Router for camera configuration."""

import json
import os
from typing import List

import cv2
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pyorc import CameraConfig as pyorcCameraConfig

from orc_api import __home__, crud
from orc_api.database import get_db
from orc_api.db import CameraConfig, Session
from orc_api.schemas.camera_config import (
    CameraConfigData,
    CameraConfigResponse,
    CameraConfigUpdate,
)
from orc_api.schemas.video import VideoResponse

UPLOAD_DIRECTORY = os.path.join(__home__, "uploads")

router: APIRouter = APIRouter(prefix="/camera_config", tags=["camera_config"])


@router.get("/empty/{video_id}", response_model=CameraConfigResponse, status_code=200)
async def empty_camera_config(video_id: int, db: Session = Depends(get_db)):
    """Create an empty camera config in-memory."""
    # return an empty camera config for now with height and width of current video
    video_rec = crud.video.get(db, video_id)
    video = VideoResponse.model_validate(video_rec)
    fn = video.get_video_file(base_path=UPLOAD_DIRECTORY)
    cap = cv2.VideoCapture(fn)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    cap.release()
    del cap
    cam_config = CameraConfigResponse(data={"height": height, "width": width})
    return cam_config


@router.get("/", response_model=List[CameraConfigResponse], description="Get all camera configurations")
async def list_camera_configs(db: Session = Depends(get_db)):
    """Retrieve full list of camera configurations."""
    camera_configs: List[CameraConfig] = crud.camera_config.list(db)
    return camera_configs


@router.get("/{camera_config_id}", response_model=CameraConfigResponse, description="Get camera configurations by ID")
async def get_camera_config_by_id(camera_config_id: int, db: Session = Depends(get_db)):
    """Retrieve a camera configuration."""
    camera_config: CameraConfig = crud.camera_config.get(db, camera_config_id)
    return camera_config


@router.post("/from_file/", response_model=CameraConfigResponse, status_code=201)
async def upload_camera_config(
    file: UploadFile,
):
    """Read a recipe file and return recipe details to the front end in-memory.

    This does not store data in the database.
    """
    camera_config_body = file.file.read()
    try:
        camera_config_dict = json.loads(camera_config_body)
    except Exception:
        raise HTTPException(status_code=400, detail="File does not contain valid JSON data")
    # try to parse to camera config
    try:
        _ = pyorcCameraConfig(**camera_config_dict)
    except Exception:
        raise HTTPException(status_code=400, detail="File does not contain valid CameraConfig data")
    return CameraConfigResponse(data=camera_config_dict)


@router.patch(
    "/{id}/", status_code=200, response_model=CameraConfigResponse, description="Update a camera configuration"
)
async def patch_camera_config(id: int, camera_config: CameraConfigUpdate, db: Session = Depends(get_db)):
    """Update a camera config in the database."""
    update_cam_config = camera_config.model_dump(exclude_none=True, include={"name", "data"})
    camera_config = crud.camera_config.update(db=db, id=id, camera_config=update_cam_config)
    return camera_config


@router.post(
    "/", response_model=CameraConfigResponse, status_code=201, description="Post a new complete Camera Configuration"
)
async def post_camera_config(camera_config: CameraConfigUpdate, db: Session = Depends(get_db)):
    """Post a new camera configuration."""
    # Create a new device record if none exists, only include the name and data fields,
    # all others are only for front end
    new_camera_config = CameraConfig(**camera_config.model_dump(exclude_none=True, include={"name", "data"}))
    db.add(new_camera_config)
    db.commit()
    db.refresh(new_camera_config)
    return new_camera_config


@router.post("/update/", response_model=CameraConfigUpdate, status_code=201)
async def update_camera_config(camera_config: CameraConfigUpdate):
    """Update an in-memory camera config.

    This only validates the input and adds default fields where necessary.
    No storage on the database is performed.
    """
    return camera_config


@router.post("/bounding_box/", response_model=CameraConfigResponse, status_code=201)
async def get_bounding_box(camera_config: CameraConfigUpdate, points: List[List[float]]):
    """Construct a bounding box from a set of points, provided by user."""
    if len(points) != 3:
        raise HTTPException(
            status_code=400, detail=f"Exactly 3 points with [column, row] must be provided. {len(points)} given"
        )
    # derive the bounding box using the points
    cc = pyorcCameraConfig(**camera_config.data.model_dump())
    cc.set_bbox_from_width_length(points)
    # new cam config data field
    data = CameraConfigData.model_validate(cc.to_dict_str())
    return CameraConfigResponse(name=camera_config.name, id=camera_config.id, data=data)
