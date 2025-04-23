"""Pydantic models for recipes."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from orc_api import crud
from orc_api.database import get_session
from orc_api.schemas.base import RemoteModel


class VideoData(BaseModel):
    """Video default data model."""

    start_frame: int = Field(default=0)
    end_frame: int = Field(default=150)
    freq: int = Field(default=1)


class FramesData(BaseModel):
    """Frames default data model."""

    time_diff: dict = Field(default={"abs": False, "thres": 5})
    minmax: dict = Field(default={"min": 5})
    project: dict = Field(default={"method": "numpy", "resolution": 0.01})


class VelocimetryData(BaseModel):
    """Velocimetry default data model."""

    get_piv: Optional[dict] = Field(default=None)
    write: bool = Field(default=True)


mask_data = {
    "write": True,
    "mask_group1": {"minmax": "s_max: 5.0"},
    "mask_group2": {"outliers": {"mode": "and"}},
    "mask_group3": {"count": {"tolerance": 0.2}},
    "mask_group4": {"window_mean": {"wdw": 2, "reduce_time": True}},
    "mask_group5": {"window_nan": {"wdw": 1, "reduce_time": True}},
}


class RecipeData(BaseModel):
    """Recipe data model."""

    video: VideoData = Field(default_factory=VideoData)
    frames: FramesData = Field(default_factory=FramesData)
    velocimetry: VelocimetryData = Field(default_factory=VelocimetryData)
    mask: dict = Field(default=mask_data)


# Pydantic model for responses
class RecipeBase(BaseModel):
    """Base model for a recipe."""

    name: Optional[str] = Field(default=None, description="Free recognizable description of cross section.")
    data: Optional[dict] = Field(default=None, description="Recipe data")
    model_config = ConfigDict(from_attributes=True)


class RecipeResponse(RecipeBase, RemoteModel):
    """Response model for a recipe."""

    id: Optional[int] = Field(default=None, description="Recipe ID")
    start_frame: int = Field(default=0, description="Frame number of the first frame of the recipe.")
    end_frame: int = Field(default=150, description="Frame number of the last frame to process.")
    freq: int = Field(default=1, description="Frame frequency.")
    resolution: float = Field(
        default=0.01, ge=0.001, le=0.05, description="Resolution of the projected video in meters."
    )
    velocimetry: Literal["piv", "stiv"] = Field(default="piv", description="Velocimetry method.")
    v_corr: float = Field(default=0.85, ge=0.5, le=1.0, description="Alpha coefficient.")
    quiver_scale_grid: float = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Scaling of the 2D quiver plot. 1.0 means 1 m/s is plotted over 1 meter distance.",
    )
    quiver_scale_cs: float = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Scaling of the cross-section quiver plot. 1.0 means 1 m/s is plotted over 1 meter distance.",
    )
    image_quality: Literal["low", "medium", "high"] = Field(
        default="medium", description="Quality of the generated images."
    )

    @model_validator(mode="after")
    def populate_fields_from_data(cls, instance):
        """Populate the fields from the recipe data."""
        if instance.data is None:
            data = RecipeData()
        else:
            data = RecipeData(**instance.data)
        # data.pop("transect", None)
        # data.pop("plot", None)
        instance.start_frame = data.video.start_frame
        instance.end_frame = data.video.end_frame
        instance.freq = data.video.freq
        instance.resolution = data.frames.project["resolution"]
        instance.velocimetry = "piv"  # make variable once other methods are available
        # instance.v_corr = 0.85
        # instance.quiver_scale_grid = 1.0
        # instance.quiver_scale_cs = 1.0
        # if hasattr(instance, "start_frame") and instance.start_frame is not None:
        #     data.video.start_frame = instance.start_frame
        # if hasattr(instance, "end_frame") and instance.end_frame is not None:
        #     data.video.end_frame = instance.end_frame
        # if hasattr(instance, "freq") and instance.freq is not None:
        #     data.video.freq = instance.freq
        # if hasattr(instance, "resolution") and instance.resolution is not None:
        #     data.frames.project["resolution"] = instance.resolution
        # if hasattr(instance, "velocimetry") and instance.velocimetry is not None:
        #     # when multiple velocimetry methods are available, provide a means to alter this
        #     pass
        instance.data = data.model_dump()
        # return instance
        # instance.quiver_scale_grid = data["quiver_scale_grid"]
        # instance.quiver_scale_cs = data["quiver_scale_cs"]
        # instance.image_quality = data["image_quality"]
        return instance

    def sync_remote(self, institute: int):
        """Send the recipe to LiveORC API.

        Recipes belong to an institute, hence also the institute ID is required.
        """
        endpoint = "/api/recipe/"
        data = {
            "name": self.name,
            "data": self.data,
            "institute": institute,
        }
        # sync remotely with the updated data, following the LiveORC end point naming
        response_data = super().sync_remote(endpoint=endpoint, json=data)
        if response_data is not None:
            # patch the record in the database, where necessary
            # update schema instance
            update_recipe = RecipeResponse.model_validate(response_data)
            r = crud.recipe.update(get_session(), id=self.id, recipe=update_recipe.model_dump(exclude_unset=True))
            return RecipeResponse.model_validate(r)
        return None


class RecipeUpdate(RecipeBase):
    """Update model with several input fields from user.

    This is vice versa from getting fields from the raw yaml / json recipe data
    """

    id: Optional[int] = Field(default=None, description="Recipe ID")
    start_frame: Optional[int] = Field(default=None, description="Frame number of the first frame of the recipe.")
    end_frame: Optional[int] = Field(default=None, description="Frame number of the last frame to process.")
    freq: Optional[int] = Field(default=None, description="Frame frequency.")
    resolution: Optional[float] = Field(
        default=None, ge=0.001, le=0.05, description="Resolution of the projected video in meters."
    )
    velocimetry: Optional[Literal["piv", "stiv"]] = Field(default=None, description="Velocimetry method.")
    v_corr: Optional[float] = Field(default=None, ge=0.5, le=1.0, description="Alpha coefficient.")
    quiver_scale_grid: Optional[float] = Field(
        default=None,
        ge=0.001,
        le=0.1,
        description="Scaling of the 2D quiver plot. 1.0 means 1 m/s is plotted over 1 meter distance.",
    )
    quiver_scale_cs: Optional[float] = Field(
        default=None,
        ge=0.001,
        le=0.1,
        description="Scaling of the cross-section quiver plot. 1.0 means 1 m/s is plotted over 1 meter distance.",
    )
    image_quality: Optional[Literal["low", "medium", "high"]] = Field(
        default=None, description="Quality of the generated images."
    )

    @model_validator(mode="after")
    def populate_data_from_fields(cls, instance):
        """Populate the fields from the recipe data."""
        if instance.data is None:
            data = RecipeData()
        else:
            data = RecipeData(**instance.data)
        # data.pop("transect", None)
        # data.pop("plot", None)
        if instance.start_frame is not None:
            data.video.start_frame = instance.start_frame
        if instance.end_frame is not None:
            data.video.end_frame = instance.end_frame
        if instance.freq is not None:
            data.video.freq = instance.freq
        if instance.resolution is not None:
            data.frames.project["resolution"] = instance.resolution
        if instance.velocimetry is not None:
            pass
        # instance.v_corr = 0.85
        # instance.quiver_scale_grid = 1.0
        # instance.quiver_scale_cs = 1.0
        # if hasattr(instance, "start_frame") and instance.start_frame is not None:
        #     data.video.start_frame = instance.start_frame
        # if hasattr(instance, "end_frame") and instance.end_frame is not None:
        #     data.video.end_frame = instance.end_frame
        # if hasattr(instance, "freq") and instance.freq is not None:
        #     data.video.freq = instance.freq
        # if hasattr(instance, "resolution") and instance.resolution is not None:
        #     data.frames.project["resolution"] = instance.resolution
        # if hasattr(instance, "velocimetry") and instance.velocimetry is not None:
        #     # when multiple velocimetry methods are available, provide a means to alter this
        #     pass
        instance.data = data.model_dump()
        # return instance
        # instance.quiver_scale_grid = data["quiver_scale_grid"]
        # instance.quiver_scale_cs = data["quiver_scale_cs"]
        # instance.image_quality = data["image_quality"]
        return instance


class RecipeCreate(RecipeResponse):
    """Create model for a recipe."""

    # The name is now a requirement
    name: str = Field(description="Free recognizable description of cross section.")
