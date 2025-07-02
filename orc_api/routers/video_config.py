"""VideoConfig routers."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from orc_api import crud, routers
from orc_api.database import get_db
from orc_api.db import VideoConfig
from orc_api.schemas.camera_config import CameraConfigUpdate
from orc_api.schemas.cross_section import CrossSectionCreate, CrossSectionUpdate
from orc_api.schemas.recipe import RecipeRemote
from orc_api.schemas.video_config import VideoConfigResponse, VideoConfigUpdate

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


@router.delete("/{id}/deps", status_code=204, response_model=None)
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


@router.post("/", response_model=VideoConfigResponse, status_code=201)
async def post_video_config(video_config: VideoConfigUpdate, db: Session = Depends(get_db)):
    """Create a new or update existing video config."""
    try:
        if video_config.camera_config:
            if video_config.camera_config.name is None:
                video_config.camera_config.name = video_config.name
            cc_update = CameraConfigUpdate.model_validate(video_config.camera_config)

            if video_config.camera_config.id:
                # update existing
                camera_config = await routers.camera_config.patch_camera_config(
                    db=db, id=video_config.camera_config.id, camera_config=cc_update
                )
            else:
                camera_config = await routers.camera_config.post_camera_config(db=db, camera_config=cc_update)
        else:
            camera_config = None
        if video_config.recipe:
            if video_config.recipe.name is None:
                video_config.recipe.name = video_config.name
            if video_config.recipe.id:
                recipe_update = RecipeRemote.model_validate(
                    video_config.recipe.model_dump(exclude={"id"}, exclude_none=True)
                )
                recipe = await routers.recipe.patch_recipe(db=db, id=video_config.recipe.id, recipe=recipe_update)
            else:
                recipe = await routers.recipe.create_recipe(db=db, recipe=video_config.recipe)
        else:
            recipe = None
        if video_config.cross_section:
            if video_config.cross_section.name is None:
                video_config.cross_section.name = video_config.name
            if video_config.cross_section.id:
                cross_section = await routers.cross_section.patch_cs(
                    db=db,
                    id=video_config.cross_section.id,
                    cs=CrossSectionUpdate.model_validate(video_config.cross_section),
                )
            else:
                cross_section = await routers.cross_section.create_cs(
                    db=db, cs=CrossSectionCreate.model_validate(video_config.cross_section)
                )
        else:
            cross_section = None

        if video_config.cross_section_wl:
            if video_config.cross_section_wl.name is None:
                video_config.cross_section_wl.name = video_config.name
            if video_config.cross_section_wl.id:
                cross_section_wl = await routers.cross_section.patch_cs(
                    db=db,
                    id=video_config.cross_section_wl.id,
                    cs=CrossSectionUpdate.model_validate(video_config.cross_section_wl),
                )
            else:
                cross_section_wl = await routers.cross_section.create_cs(
                    db=db, cs=CrossSectionCreate.model_validate(video_config.cross_section_wl)
                )
        else:
            cross_section_wl = None

        # finally also write the VideoConfig itself
        video_config = VideoConfigResponse.model_validate(
            video_config.model_dump(
                exclude_none=True,
                exclude={"camera_config", "recipe", "cross_section", "cross_section_wl"},
            )
        )
        # ensure ids of foreign objects are set
        video_config.camera_config_id = camera_config.id if camera_config else None
        video_config.recipe_id = recipe.id if recipe else None
        video_config.cross_section_id = cross_section.id if cross_section else None
        video_config.cross_section_wl_id = cross_section_wl.id if cross_section_wl else None
        # store or update! only use ids, not the actual relationships
        video_config_dict = {
            "name": video_config.name,
            "cross_section_id": video_config.cross_section_id,
            "cross_section_wl_id": video_config.cross_section_wl_id,
            "recipe_id": video_config.recipe_id,
            "camera_config_id": video_config.camera_config_id,
            "sample_video_id": video_config.sample_video_id,
        }
        if video_config.id:
            # convert into dict
            video_config = crud.video_config.update(id=video_config.id, db=db, video_config=video_config_dict)
        else:
            # convert into record
            video_config_rec = VideoConfig(**video_config_dict)
            video_config = crud.video_config.add(db=db, video_config=video_config_rec)
        # now validate before returning so that we can catch problems
        video_config = VideoConfigResponse.model_validate(video_config)
        return video_config
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
