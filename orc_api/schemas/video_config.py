"""Pydantic schema for VideoConfig validation."""

import copy
import json
from typing import TYPE_CHECKING, Optional

import geopandas as gpd
import numpy as np
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, conlist, model_validator
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db import SyncStatus, VideoConfig
from orc_api.schemas.base import RemoteModel
from orc_api.schemas.callback_url import CallbackUrlResponse
from orc_api.schemas.camera_config import CameraConfigResponse, CameraConfigUpdate
from orc_api.schemas.cross_section import CrossSectionResponse, CrossSectionResponseCameraConfig
from orc_api.schemas.recipe import RecipeResponse, RecipeUpdate

# only import for type checking on run time, preventing circular imports
if TYPE_CHECKING:
    pass


# for all functions here, get the request object
def _rodrigues_to_matrix(rvec):
    """Convert rotation vector to a rotation matrix using Rodrigues' formula."""
    # Ensure rvec is a NumPy array
    rvec = np.asarray(rvec, dtype=np.float64)
    theta = np.linalg.norm(rvec)  # Rotation angle

    if theta < 1e-8:  # If the angle is too small, return the identity matrix
        return np.eye(3)

    # Normalize the rotation vector to get the rotation axis
    k = rvec / theta

    # Create the skew-symmetric matrix of k
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])

    # Compute the rotation matrix using Rodrigues' formula
    I = np.eye(3)
    R = I + np.sin(theta) * K + (1 - np.cos(theta)) * np.dot(K, K)
    return R


def _rotate_translate_cross_section(cross_section, rvec, tvec):
    # Ensure rvec and tvec are numpy arrays
    rvec = np.array(rvec, dtype=np.float64)
    tvec = np.array(tvec, dtype=np.float64)

    # Convert rotation vector to rotation matrix using Rodrigues' formula
    rotation_matrix = _rodrigues_to_matrix(rvec)
    # Transform the features
    gdf = copy.deepcopy(cross_section.gdf)
    geoms = gdf.geometry
    x, y, z = geoms.x.values, geoms.y.values, geoms.z.values
    # reduce by mean
    x_mean, y_mean, z_mean = np.mean(x), np.mean(y), np.mean(z)
    _x, _y, _z = x - x_mean, y - y_mean, z - z_mean
    points = np.array([_x, _y, _z])

    transformed_points = (rotation_matrix @ points).T + tvec
    # now add the original mean
    transformed_points += np.array([x_mean, y_mean, z_mean])
    new_geoms = gpd.points_from_xy(transformed_points[:, 0], transformed_points[:, 1], transformed_points[:, 2])
    gdf.geometry = new_geoms
    geo_dict = json.loads(gdf.to_json())
    # make a new VideoConfig
    cross_new = cross_section.model_dump(exclude=["features"])
    cross_new["features"] = geo_dict
    return CrossSectionResponse(**cross_new)


class VideoConfigBase(BaseModel):
    """Pydantic schema for VideoConfig validation."""

    id: Optional[int] = Field(default=None, description="Video configuration ID")
    name: str = Field(description="Named description of the video configuration.")
    rvec: Optional[conlist(float, min_length=3, max_length=3)] = Field(
        [0.0, 0.0, 0.0], description="Rotation vector for matching CrossSection for discharge with CameraConfig."
    )
    tvec: Optional[conlist(float, min_length=3, max_length=3)] = Field(
        default=[0.0, 0.0, 0.0],
        description="Translation vector for matching CrossSection for discharge with CameraConfig.",
    )
    rvec_wl: Optional[conlist(float, min_length=3, max_length=3)] = Field(
        [0.0, 0.0, 0.0], description="Rotation vector for matching CrossSection for water level with CameraConfig."
    )
    tvec_wl: Optional[conlist(float, min_length=3, max_length=3)] = Field(
        default=[0.0, 0.0, 0.0],
        description="Translation vector for matching CrossSection for water level with CameraConfig.",
    )

    camera_config: Optional[CameraConfigResponse] = Field(
        default=None, description="Associated CameraConfig object (if available)."
    )
    recipe: Optional[RecipeResponse] = Field(None, description="Associated Recipe object (if available).")
    cross_section: Optional[CrossSectionResponseCameraConfig] = Field(
        default=None, description="Associated CrossSection object (if available)."
    )
    cross_section_wl: Optional[CrossSectionResponseCameraConfig] = Field(
        default=None, description="Associated CrossSection object for water level estimation (if available)."
    )
    model_config = {"from_attributes": True}
    sample_video_id: Optional[int] = Field(
        default=None, description="Video ID containing reference information such as GCPs"
    )

    @model_validator(mode="after")
    def match_crs(cls, v):
        """Match CRS of CameraConfig and CrossSection."""
        if v.cross_section and v.camera_config:
            if v.cross_section.crs and v.camera_config.crs:
                if v.cross_section.crs != v.camera_config.crs:
                    # transform cross-section coordinates
                    gdf = v.cross_section.gdf.to_crs(v.camera_config.crs)
                    v.cross_section.features = json.loads(gdf.to_json())
        return v

    @model_validator(mode="after")
    def complete_cross_sections(cls, v):
        """Complete the cross-sections with the camera configuration."""
        if v.cross_section and v.camera_config:
            cs = v.cross_section
            cs.camera_config = v.camera_config
            v.cross_section = CrossSectionResponseCameraConfig.model_validate(cs)
        if v.cross_section_wl and v.camera_config:
            cs = v.cross_section_wl
            cs.camera_config = v.camera_config
            v.cross_section_wl = CrossSectionResponseCameraConfig.model_validate(cs)
        return v

    @property
    def cross_section_rt(self):
        """Transform the cross_section.features by applying rotation (rvec) and translation (tvec).

        Returns CrossSectionResponse with transformed features.
        """
        if not self.cross_section or not hasattr(self.cross_section, "features"):
            raise ValueError("cross_section or its features are not defined.")
        return _rotate_translate_cross_section(self.cross_section, self.rvec, self.tvec)

    @property
    def cross_section_wl_rt(self):
        """Transform the cross_section.features by applying rotation (rvec) and translation (tvec).

        Returns CrossSectionResponse with transformed features.
        """
        if not self.cross_section_wl or not hasattr(self.cross_section_wl, "features"):
            raise ValueError("cross_section_wl or its features are not defined.")
        return _rotate_translate_cross_section(self.cross_section_wl, self.rvec_wl, self.tvec_wl)

        # # Ensure rvec and tvec are numpy arrays
        # rvec = np.array(self.rvec, dtype=np.float64)
        # tvec = np.array(self.tvec, dtype=np.float64)
        #
        # # Convert rotation vector to rotation matrix using Rodrigues' formula
        # rotation_matrix = rodrigues_to_matrix(rvec)
        # # Transform the features
        # gdf = copy.deepcopy(self.cross_section.gdf)
        # geoms = gdf.geometry
        # x, y, z = geoms.x.values, geoms.y.values, geoms.z.values
        # # reduce by mean
        # x_mean, y_mean, z_mean = np.mean(x), np.mean(y), np.mean(z)
        # _x, _y, _z = x - x_mean, y - y_mean, z - z_mean
        # points = np.array([_x, _y, _z])
        #
        # transformed_points = (rotation_matrix @ points).T + tvec
        # # now add the original mean
        # transformed_points += np.array([x_mean, y_mean, z_mean])
        # new_geoms = gpd.points_from_xy(transformed_points[:, 0], transformed_points[:, 1], transformed_points[:, 2])
        # gdf.geometry = new_geoms
        # geo_dict = json.loads(gdf.to_json())
        # # make a new VideoConfig
        # cross_new = self.cross_section.model_dump(exclude=["features"])
        # cross_new["features"] = geo_dict
        # return CrossSectionResponse(**cross_new)

    @property
    def recipe_transect_filled(self):
        """Return the recipe with transects filled with the cross_section_rt."""
        if not self.recipe or not hasattr(self.recipe, "data"):
            raise ValueError("recipe or its data are not defined.")
        if self.cross_section_rt is None:
            raise ValueError("cross_section is not defined.")
        recipe = copy.deepcopy(self.recipe.data)
        if "transect" in recipe:
            if "transect_1" in recipe["transect"]:
                if "shapefile" in recipe["transect"]["transect_1"]:
                    del recipe["transect"]["transect_1"]["shapefile"]
                # fill in the coordinates
                recipe["transect"]["transect_1"]["geojson"] = self.cross_section_rt.features
        recipe_new = self.recipe.model_dump(exclude={"data"})
        recipe_new["data"] = recipe
        return RecipeResponse(**recipe_new)

    @property
    def allowed_to_run(self):
        """Check if the video config is ready to run."""
        # check if camera config is complete, it must have fitted pose, bounding box
        if self.camera_config is None:
            return False
        if self.recipe is None:
            return False
        if not self.camera_config.allowed_to_run:
            return False
        if not self.cross_section:
            return False
        return True


class VideoConfigRemote(VideoConfigBase, RemoteModel):
    """Remote schema for VideoConfig."""

    pass


class VideoConfigResponse(VideoConfigRemote):
    """Response schema for VideoConfig."""

    id: Optional[int] = Field(default=None, description="Video configuration ID")
    camera_config_id: Optional[int] = Field(default=None, description="Foreign key to the camera configuration.", ge=1)
    recipe_id: Optional[int] = Field(default=None, description="Foreign key to the recipe.", ge=1)
    cross_section_id: Optional[int] = Field(
        default=None, description="Optional foreign key to the cross section.", ge=1
    )
    cross_section_wl_id: Optional[int] = Field(
        default=None, description="Optional foreign key to the water level cross section.", ge=1
    )
    ready_to_run: bool = Field(default=False, description="Flag to indicate if the video config is ready to run.")
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def check_if_ready_to_run(cls, v):
        """Ensure that ready to run state is provided to front end."""
        v.ready_to_run = v.allowed_to_run
        return v

    def sync_remote(self, session: Session, site: int):
        """Send the video config to LiveORC API.

        Recipes belong to an institute, hence also the institute ID is required. Will be taken from the site.
        """
        # first check if the recipe and cross section are synced
        if self.recipe is not None:
            if self.recipe.sync_status != SyncStatus.SYNCED:
                # first sync/update recipe, we need the institute belonging to the site
                callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(session))
                r = callback_url.get_site(site_id=site)
                institute = r.json()["institute"] if r.status_code == 200 else None
                self.recipe = self.recipe.sync_remote(session=session, institute=institute)
                self.recipe_id = self.recipe.id
        if self.cross_section is not None:
            if self.cross_section.sync_status != SyncStatus.SYNCED:
                # first sync/update cross-section
                self.cross_section = self.cross_section.sync_remote(session=session, site=site)
                self.cross_section_id = self.cross_section.id
        # now report the entire video config (this currently reports to cameraconfig,
        # should be updated after LiveORC restructuring)
        endpoint = f"/api/site/{site}/cameraconfig/"
        data = {
            "name": self.name,
            "camera_config": self.camera_config.data.model_dump(),
            "recipe": self.recipe.remote_id,
            "profile": self.cross_section.remote_id,
        }
        # sync remotely with the updated data, following the LiveORC end point naming
        response_data = super().sync_remote(session=session, endpoint=endpoint, json=data)
        # ids of recipe and profile are already known and remote ids already updated, so remove
        if response_data is not None:
            response_data.pop("recipe")  # these are different on LiveORC, as they are with a datetime stamp
            response_data.pop("profile")  # same
            response_data.pop("camera_config")
            response_data.pop("server")
            response_data["camera_config_id"] = self.camera_config_id
            response_data["recipe_id"] = self.recipe_id
            response_data["cross_section_id"] = self.cross_section_id
            # LiveORC has not tvec / rvec logic yet, so add from existing
            response_data["rvec"] = self.rvec
            response_data["tvec"] = self.tvec

            # patch the record in the database, where necessary
            # update schema instance
            update_video_config = VideoConfigResponse.model_validate(response_data)
            r = crud.video_config.update(
                session, id=self.id, video_config=update_video_config.model_dump(exclude_unset=True)
            )
        video_config = VideoConfigResponse.model_validate(r)
        return video_config

    def patch_post_children(self, db: Session):
        """Patch or post children of this instance."""
        models = ["recipe", "camera_config", "cross_section", "cross_section_wl"]
        for model in models:
            instance = getattr(self, model)
            if instance is not None:
                if instance.name is None:
                    # give the same name as parent
                    instance.name = self.name
                setattr(self, model, instance.patch_post(db=db))

    def get_patch_post_dict(self):
        """Get dictionary of fields for patching or posting children."""
        video_config = VideoConfigResponse.model_validate(
            self.model_dump(
                exclude_none=True,
                exclude={"camera_config", "recipe", "cross_section", "cross_section_wl"},
            )
        )
        return {
            "name": video_config.name,
            "cross_section_id": video_config.cross_section_id,
            "cross_section_wl_id": video_config.cross_section_wl_id,
            "recipe_id": video_config.recipe_id,
            "camera_config_id": video_config.camera_config_id,
            "sample_video_id": video_config.sample_video_id,
            "sync_status": video_config.sync_status,
        }

    def patch_post(self, db: Session):
        """Save new instance to database including underlying recipe, camera config and cross sections if needed."""
        try:
            # first update or save underlying models
            self.patch_post_children(db=db)
            # attach ids, these are the only things stored
            self.camera_config_id = self.camera_config.id if self.camera_config else None
            self.recipe_id = self.recipe.id if self.recipe else None
            self.cross_section_id = self.cross_section.id if self.cross_section else None
            self.cross_section_wl_id = self.cross_section_wl.id if self.cross_section_wl else None
            patch_post_dict = self.get_patch_post_dict()
            if self.id is None:
                # record does not exist, create new
                # convert into record
                video_config_rec = VideoConfig(**patch_post_dict)
                video_config = crud.video_config.add(db=db, video_config=video_config_rec)
            else:
                # only patch existing record
                video_config = crud.video_config.update(id=self.id, db=db, video_config=patch_post_dict)
            # validate before returning so that we can catch problems
            video_config = VideoConfigResponse.model_validate(video_config)
            return video_config
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e)) from e


class VideoConfigUpdate(VideoConfigResponse):
    """Patch schema for VideoConfig."""

    # override the camera config and recipe models by update models
    camera_config: Optional[CameraConfigUpdate] = Field(
        default=None, description="Associated CameraConfig object (if available)."
    )
    recipe: Optional[RecipeUpdate] = Field(None, description="Associated Recipe object (if available).")
