"""Pydantic schema for VideoConfig validation."""

import copy
import json
from typing import TYPE_CHECKING, Optional

import geopandas as gpd
import numpy as np
from pydantic import BaseModel, Field, conlist, model_validator

from orc_api import crud
from orc_api.database import get_session
from orc_api.db import SyncStatus
from orc_api.schemas.base import RemoteModel
from orc_api.schemas.callback_url import CallbackUrlResponse
from orc_api.schemas.camera_config import CameraConfigResponse
from orc_api.schemas.cross_section import CrossSectionResponse
from orc_api.schemas.recipe import RecipeResponse

# only import for type checking on run time, preventing circular imports
if TYPE_CHECKING:
    pass


def rodrigues_to_matrix(rvec):
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


class VideoConfigBase(BaseModel):
    """Pydantic schema for VideoConfig validation."""

    id: Optional[int] = Field(default=None, description="Video configuration ID")
    name: str = Field(description="Named description of the video configuration.")
    rvec: Optional[conlist(float, min_length=3, max_length=3)] = Field(
        [0.0, 0.0, 0.0], description="Rotation vector for matching CrossSection with CameraConfig."
    )
    tvec: Optional[conlist(float, min_length=3, max_length=3)] = Field(
        default=[0.0, 0.0, 0.0], description="Translation vector for matching CrossSection with CameraConfig."
    )
    camera_config: Optional[CameraConfigResponse] = Field(
        default=None, description="Associated CameraConfig object (if available)."
    )
    recipe: Optional[RecipeResponse] = Field(None, description="Associated Recipe object (if available).")
    cross_section: Optional[CrossSectionResponse] = Field(
        default=None, description="Associated CrossSection object (if available)."
    )
    cross_section_wl: Optional[CrossSectionResponse] = Field(
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

    @property
    def cross_section_rt(self):
        """Transform the cross_section.features by applying rotation (rvec) and translation (tvec).

        Returns CrossSectionResponse with transformed features.
        """
        if not self.cross_section or not hasattr(self.cross_section, "features"):
            raise ValueError("cross_section or its features are not defined.")

        # Ensure rvec and tvec are numpy arrays
        rvec = np.array(self.rvec, dtype=np.float64)
        tvec = np.array(self.tvec, dtype=np.float64)

        # Convert rotation vector to rotation matrix using Rodrigues' formula
        rotation_matrix = rodrigues_to_matrix(rvec)
        # Transform the features
        gdf = copy.deepcopy(self.cross_section.gdf)
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
        cross_new = self.cross_section.model_dump(exclude=["features"])
        cross_new["features"] = geo_dict
        return CrossSectionResponse(**cross_new)

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

    def sync_remote(self, site: int):
        """Send the video config to LiveORC API.

        Recipes belong to an institute, hence also the institute ID is required. Will be taken from the site.
        """
        # first check if the recipe and cross section are synced
        with get_session() as db:
            if self.recipe is not None:
                if self.recipe.sync_status != SyncStatus.SYNCED:
                    # first sync/update recipe, we need the institute belonging to the site
                    callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(db))
                    r = callback_url.get_site(site_id=site)
                    institute = r.json()["institute"] if r.status_code == 200 else None
                    self.recipe = self.recipe.sync_remote(institute=institute)
                    self.recipe_id = self.recipe.id
            if self.cross_section is not None:
                if self.cross_section.sync_status != SyncStatus.SYNCED:
                    # first sync/update cross-section
                    self.cross_section = self.cross_section.sync_remote(site=site)
                    self.cross_section_id = self.cross_section.id
            # now report the entire video config (this currently reports to cameraconfig,
            # should be updated after LiveORC restructuring)
            endpoint = f"/api/site/{site}/cameraconfig/"
            data = {
                "name": self.name,
                "camera_config": self.camera_config.data,
                "recipe": self.recipe.remote_id,
                "profile": self.cross_section.remote_id,
            }
            # sync remotely with the updated data, following the LiveORC end point naming
            response_data = super().sync_remote(endpoint=endpoint, json=data)
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
                    db, id=self.id, video_config=update_video_config.model_dump(exclude_unset=True)
                )
            video_config = VideoConfigResponse.model_validate(r)
        return video_config


class VideoConfigPatch(VideoConfigBase):
    """Patch schema for VideoConfig."""
