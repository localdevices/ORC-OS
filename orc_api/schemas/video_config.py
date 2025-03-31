"""Pydantic schema for VideoConfig validation."""

import copy
import json
from typing import Optional

import geopandas as gpd
import numpy as np
from pydantic import BaseModel, Field, conlist, model_validator

from orc_api.schemas.camera_config import CameraConfigBase
from orc_api.schemas.cross_section import CrossSectionBase
from orc_api.schemas.recipe import RecipeBase


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

    id: int = Field(..., description="Primary key representing the video configuration.")
    name: str = Field(..., description="Named description of the video configuration.")
    camera_config_id: int = Field(..., description="Foreign key to the camera configuration.", ge=1)
    recipe_id: int = Field(..., description="Foreign key to the recipe.", ge=1)
    cross_section_id: Optional[int] = Field(None, description="Optional foreign key to the cross section.", ge=1)
    rvec: conlist(float, min_length=3, max_length=3) = Field(
        ..., description="Rotation vector for matching CrossSection with CameraConfig."
    )
    tvec: conlist(float, min_length=3, max_length=3) = Field(
        ..., description="Translation vector for matching CrossSection with CameraConfig."
    )
    camera_config: Optional[CameraConfigBase] = Field(
        None, description="Associated CameraConfig object (if available)."
    )
    recipe: Optional[RecipeBase] = Field(None, description="Associated Recipe object (if available).")

    cross_section: Optional[CrossSectionBase] = Field(
        None, description="Associated CrossSection object (if available)."
    )
    model_config = {"from_attributes": True}

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
        return CrossSectionBase(**cross_new)

    @property
    def recipe_transect_filled(self):
        """Return the recipe with transects filled with the cross_section_rt."""
        if not self.recipe or not hasattr(self.recipe, "data"):
            raise ValueError("recipe or its data are not defined.")
        recipe = copy.deepcopy(self.recipe.data)
        if "transect" in recipe:
            if "transect_1" in recipe["transect"]:
                if "shapefile" in recipe["transect"]["transect_1"]:
                    del recipe["transect"]["transect_1"]["shapefile"]
                # fill in the coordinates
                recipe["transect"]["transect_1"]["geojson"] = self.cross_section_rt.features
        recipe_new = self.recipe.model_dump(exclude=["data"])
        recipe_new["data"] = recipe
        return RecipeBase(**recipe_new)
