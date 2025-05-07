"""VideoConfig routers."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.database import get_db
from orc_api.schemas.video_config import VideoConfigBase, VideoConfigResponse

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


@router.post("/", response_model=VideoConfigResponse, status_code=201)
async def post_video_config(video_config: VideoConfigBase, db: Session = Depends(get_db)):
    """Create a new or update existing video config."""
    print(video_config)
    # if video_config.id:
    #     video_config = crud.video_config.update(db=db, video_config=video_config)
    # else:
    #     video_config = crud.video_config.add(db=db, video_config=video_config)
    # return video_config
