"""VideoConfig routers."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.database import get_db
from orc_api.schemas.video_config import VideoConfigResponse

router: APIRouter = APIRouter(prefix="/video_config", tags=["video_config"])


@router.get("/", response_model=List[VideoConfigResponse], status_code=200)
async def get_list_video_config(db: Session = Depends(get_db)):
    """Retrieve list of video configs."""
    list_videos = crud.video_config.get_list(db)
    return list_videos


@router.get("/{id}/", response_model=VideoConfigResponse, status_code=200)
async def get_video_config(id: int, db: Session = Depends(get_db)):
    """Retrieve a video config by id."""
    video_config = crud.video_config.get(db=db, id=id)
    if not video_config:
        raise HTTPException(status_code=404, detail="VideoConfig not found.")
    return video_config


@router.delete("/{id}/", status_code=204, response_model=None)
async def delete_video_config(id: int, db: Session = Depends(get_db)):
    """Delete a video config."""
    _ = crud.video_config.delete(db=db, id=id)
    return


@router.delete("/{id}/deps/", status_code=204, response_model=None)
async def delete_video_config_with_deps(id: int, db: Session = Depends(get_db)):
    """Delete a video config and attempt to also delete the associated camera config and recipe, if they exist."""
    warn = False
    video_config = crud.video_config.get(db=db, id=id)
    recipe_id = video_config.recipe_id
    camera_config_id = video_config.camera_config_id
    # first delete the video_config
    _ = crud.video_config.delete(db=db, id=id)
    try:
        if recipe_id:
            _ = crud.recipe.delete(db=db, id=recipe_id)
    except Exception:
        warn = True
        detail = "Problem deleting recipe dependency. Perhaps another config is using it?"
    try:
        if camera_config_id:
            _ = crud.camera_config.delete(db=db, id=camera_config_id)
    except Exception:
        warn = True
        detail = "Problem deleting camera configuration dependency. Perhaps another config is using it?"

    if warn:
        raise HTTPException(status_code=500, detail=detail)
    return


# @router.post("/", response_model=VideoConfigResponse, status_code=201)
# async def patch_post_video_config(video_config: VideoConfigUpdate, db: Session = Depends(get_db)):
#     """Create a new or update existing video config."""
#     try:
#         return video_config.patch_post(db=db)
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=str(e))
