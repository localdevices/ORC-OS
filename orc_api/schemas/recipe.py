"""Pydantic models for recipes."""

from typing import List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.schemas.base import RemoteModel

frames_options = {
    "manmade": [{"method": "grayscale", "range": {}, "s2n_thres": 3}, {"method": "grayscale", "s2n_thres": 3}],
    "natural": [{"method": "grayscale", "range": {}, "s2n_thres": 2.5}, {"method": "sat", "s2n_thres": 2.5}],
}


class VideoData(BaseModel):
    """Video default data model."""

    start_frame: int = Field(default=0)
    end_frame: Optional[int] = Field(default=10)
    freq: int = Field(default=1)
    lazy: bool = Field(default=False)


class FramesData(BaseModel):
    """Frames default data model."""

    time_diff: dict = Field(default={"abs": False, "thres": 5})
    minmax: dict = Field(default={"min": 5})
    project: dict = Field(default={"method": "numpy", "resolution": 0.02})


# class FramesOptions(BaseModel):
#     """Frames options default data model."""
#
#     range: Optional[dict] = Field(default={})


class WaterLevelOptions(BaseModel):
    """Water level options default data model."""

    bank: Literal["far", "near"] = Field(default="far")
    length: float = Field(default=3.0)
    padding: float = Field(default=0.5)
    min_z: Optional[float] = Field(default=None)  # minimum water level detection
    max_z: Optional[float] = Field(default=None)  # maximum water level detection


class WaterLevel(BaseModel):
    """Water level default data model."""

    n_start: int = Field(default=0)
    n_end: int = Field(default=1)
    method: str = Field(default="grayscale")
    water_level_options: WaterLevelOptions = Field(default_factory=WaterLevelOptions)
    # frames_options can be a list of dicts for several consecutive treatments, default is for man-made
    # channels
    frames_options: Union[List, dict] = Field(default=frames_options["manmade"])


class VelocimetryData(BaseModel):
    """Velocimetry default data model."""

    get_piv: Optional[dict] = Field(default={"window_size": 64})
    write: bool = Field(default=True)


class TransectData(BaseModel):
    """Transect default data model."""

    write: bool = Field(default=True)
    transect_1: dict = Field(
        default={
            "get_transect": {"rolling": 4, "tolerance": 0.3, "wdw_x_min": -5, "wdw_x_max": 5, "distance": 0.5},
            "get_q": {"fill_method": "log_interp", "v_corr": 0.85},
            "get_river_flow": {},
        }
    )


class PlotData(BaseModel):
    """Plot default data model."""

    plot_quiver: dict = Field(
        default={
            "frames": {},
            "velocimetry": {"alpha": 0.4, "scale": 1.0, "width": 1.0},
            "transect": {
                "transect_1": {"alpha": 0.8, "add_colorbar": True, "add_text": True, "scale": 1.0, "width": 1.0},
            },
            "mode": "camera",
            "reducer": "mean",
            "write_pars": {"dpi": 300, "bbox_inches": "tight"},
        }
    )


mask_data = {
    "write": True,
    "mask_group1": {"minmax": {"s_max": 5.0}},
    "mask_group2": {"outliers": {"mode": "and"}},
    "mask_group3": {"count": {"tolerance": 0.2}},
    "mask_group4": {"window_mean": {"wdw": 2, "reduce_time": True}},
    "mask_group5": {"window_nan": {"wdw": 1, "reduce_time": True}},
}


class RecipeData(BaseModel):
    """Recipe data model."""

    video: VideoData = Field(default_factory=VideoData)
    water_level: WaterLevel = Field(default_factory=WaterLevel)
    frames: FramesData = Field(default_factory=FramesData)
    velocimetry: VelocimetryData = Field(default_factory=VelocimetryData)
    mask: dict = Field(default=mask_data)
    transect: TransectData = Field(default_factory=TransectData)
    plot: PlotData = Field(default_factory=PlotData)


# Pydantic model for responses
class RecipeBase(BaseModel):
    """Base model for a recipe."""

    name: Optional[str] = Field(default=None, description="Free recognizable description of cross section.")
    data: Optional[dict] = Field(default=None, description="Recipe data")
    model_config = ConfigDict(from_attributes=True)


class RecipeRemote(RecipeBase, RemoteModel):
    """Model for a recipe with remote fields included."""

    pass


class RecipeResponse(RecipeRemote):
    """Response model for a recipe with front-end components included."""

    id: Optional[int] = Field(default=None, description="Recipe ID")
    start_frame: int = Field(default=0, description="Frame number of the first frame of the recipe.")
    end_frame: int = Field(default=150, description="Frame number of the last frame to process.")
    lazy: bool = Field(default=False, description="Lazy loading of videos.")
    freq: int = Field(default=1, description="Frame frequency.")
    resolution: float = Field(
        default=0.01, ge=0.001, le=0.05, description="Resolution of the projected video in meters."
    )
    window_size: int = Field(default=64, description="Size of interrogation window")
    velocimetry: Optional[Literal["piv", "stiv"]] = Field(default="piv", description="Velocimetry method.")
    wl_get_frames_method: Optional[Literal["natural", "manmade"]] = Field(
        default="manmade", description="Method for treating frames for water level estimation."
    )
    v_distance: Optional[float] = Field(
        default=0.5, ge=0.1, le=1.0, description="Distance between velocity sampling points in cross section."
    )
    alpha: Optional[float] = Field(default=0.85, ge=0.5, le=1.0, description="Alpha coefficient.")
    min_z: Optional[float] = Field(default=None, description="Minimum water level.")
    max_z: Optional[float] = Field(default=None, description="Maximum water level.")
    padding: Optional[float] = Field(
        default=0.5, description="Padding of the rectangles to measure water level optically."
    )
    length: Optional[float] = Field(
        default=3.0, description="Length of the rectangles for measuring water level optically."
    )
    bank: Optional[Literal["far", "near"]] = Field(default="far", description="Bank of the water level measurement.")

    quiver_scale_grid: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Scaling of the 2D quiver plot. 1.0 default",
    )
    quiver_scale_cs: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Scaling of the cross-section quiver plot. 1.0 default",
    )
    quiver_width_grid: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Relative width of the 2D quiver plot. 1.0 default",
    )
    quiver_width_cs: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Relative width of the cross-section quiver plot. 1.0 default",
    )

    image_quality: Optional[Literal["low", "medium", "high"]] = Field(
        default="medium", description="Quality of the generated images."
    )

    @model_validator(mode="after")
    def populate_fields_from_data(cls, instance):
        """Populate the fields from the recipe data."""
        if instance.data is None:
            data = RecipeData()
        else:
            data = RecipeData(**instance.data)
        instance.start_frame = data.video.start_frame
        instance.end_frame = data.video.end_frame
        instance.lazy = data.video.lazy
        instance.freq = data.video.freq
        instance.resolution = data.frames.project["resolution"]
        if "window_size" in data.velocimetry.get_piv:
            instance.window_size = data.velocimetry.get_piv["window_size"]
        # instance.velocimetry = "piv"  # make variable once other methods are available
        if "distance" in data.transect.transect_1["get_transect"]:
            instance.v_distance = data.transect.transect_1["get_transect"]["distance"]
        if "v_corr" in data.transect.transect_1["get_q"]:
            instance.alpha = data.transect.transect_1["get_q"]["v_corr"]
        if "velocimetry" in data.plot.plot_quiver:
            if "scale" in data.plot.plot_quiver["velocimetry"]:
                instance.quiver_scale_grid = 1 / data.plot.plot_quiver["velocimetry"]["scale"]
            if "width" in data.plot.plot_quiver["velocimetry"]:
                instance.quiver_width_grid = data.plot.plot_quiver["velocimetry"]["width"]
        if "transect" in data.plot.plot_quiver:
            if "transect_1" in data.plot.plot_quiver["transect"]:
                if "scale" in data.plot.plot_quiver["transect"]["transect_1"]:
                    instance.quiver_scale_cs = 1 / data.plot.plot_quiver["transect"]["transect_1"]["scale"]
                if "width" in data.plot.plot_quiver["transect"]["transect_1"]:
                    instance.quiver_width_cs = data.plot.plot_quiver["transect"]["transect_1"]["width"]

        # fill the optical level estimation parameters
        if data.water_level:
            instance.wl_get_frames_method = "manmade"
            if data.water_level.frames_options:
                # frames are treated as natural if the second treatment is in saturation
                if isinstance(data.water_level.frames_options, list):
                    if "sat" in data.water_level.frames_options[1].keys():
                        instance.wl_get_frames_method = "natural"
            if data.water_level.water_level_options:
                # set options for the detection algorithm (literally the same names are used
                for k, v in data.water_level.water_level_options.model_dump().items():
                    if v is not None:
                        setattr(instance, k, v)
        # finally add the data arg itself as raw dict
        instance.data = data.model_dump()
        return instance

    def sync_remote(self, session: Session, institute: int):
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
        response_data = super().sync_remote(session=session, endpoint=endpoint, json=data)
        if response_data is not None:
            # patch the record in the database, where necessary
            # update schema instance
            update_recipe = RecipeRemote.model_validate(response_data)
            r = crud.recipe.update(session, id=self.id, recipe=update_recipe.model_dump(exclude_unset=True))
            return RecipeResponse.model_validate(r)
        return None


class RecipeUpdate(RecipeRemote):
    """Update model with several input fields from user.

    This is vice versa from getting fields from the raw yaml / json recipe data
    """

    id: Optional[int] = Field(default=None, description="Recipe ID")
    start_frame: Optional[int] = Field(default=None, description="Frame number of the first frame of the recipe.")
    end_frame: Optional[int] = Field(default=None, description="Frame number of the last frame to process.")
    lazy: Optional[bool] = Field(default=None, description="Lazy loading of videos.")
    freq: Optional[int] = Field(default=None, description="Frame frequency.")
    resolution: Optional[float] = Field(
        default=None, ge=0.001, le=0.05, description="Resolution of the projected video in meters."
    )
    window_size: Optional[int] = Field(default=64, description="Size of interrogation window")
    velocimetry: Optional[Literal["piv", "stiv"]] = Field(default=None, description="Velocimetry method.")
    wl_get_frames_method: Optional[Literal["natural", "manmade"]] = Field(
        default="manmade", description="Method for processing video for water level estimation."
    )
    v_distance: Optional[float] = Field(
        default=0.5, ge=0.1, le=1.0, description="Distance between velocity sampling points in cross section."
    )
    alpha: Optional[float] = Field(default=0.85, ge=0.5, le=0.95, description="Alpha coefficient.")
    min_z: Optional[float] = Field(default=None, description="Minimum water level.")
    max_z: Optional[float] = Field(default=None, description="Maximum water level.")
    padding: Optional[float] = Field(
        default=0.5, description="Padding of the rectangles to measure water level optically."
    )
    length: Optional[float] = Field(
        default=3.0, description="Length of the rectangles for measuring water level optically."
    )
    bank: Optional[Literal["far", "near"]] = Field(default="far", description="Bank of the water level measurement.")

    quiver_scale_grid: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Scaling of the 2D quiver plot. 1.0 means 1 m/s is plotted over 1 meter distance.",
    )
    quiver_scale_cs: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Scaling of the cross-section quiver plot. 1.0 means 1 m/s is plotted over 1 meter distance.",
    )
    quiver_width_grid: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Relative width of the 2D quiver plot. 1.0 default",
    )
    quiver_width_cs: Optional[float] = Field(
        default=1.0,
        ge=0.2,
        le=2,
        description="Relative width of the cross-section quiver plot. 1.0 default",
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
        data.video.start_frame = getattr(instance, "start_frame", 0)
        data.water_level.n_start = getattr(instance, "start_frame", 0)
        if instance.end_frame is not None:
            data.video.end_frame = instance.end_frame
            data.water_level.n_end = instance.end_frame
        if instance.lazy is not None:
            data.video.lazy = instance.lazy
        data.video.freq = getattr(instance, "freq", 1)
        data.frames.project["resolution"] = getattr(instance, "resolution", 0.02)
        if instance.window_size is not None:
            data.velocimetry.get_piv["window_size"] = getattr(instance, "window_size", 64)
        data.transect.transect_1.setdefault("get_transect", {})["distance"] = getattr(instance, "v_distance", 0.5)
        data.transect.transect_1.setdefault("get_q", {})["v_corr"] = getattr(instance, "alpha", 0.85)
        data.plot.plot_quiver.setdefault("velocimetry", {})["scale"] = 1 / getattr(instance, "quiver_scale_grid", 1.0)
        data.plot.plot_quiver.setdefault("transect", {}).setdefault("transect_1", {})["scale"] = 1 / getattr(
            instance, "quiver_scale_cs", 1.0
        )
        data.plot.plot_quiver.setdefault("velocimetry", {})["width"] = getattr(instance, "quiver_width_grid", 1.0)
        data.plot.plot_quiver.setdefault("transect", {}).setdefault("transect_1", {})["width"] = getattr(
            instance, "quiver_width_cs", 1.0
        )
        data.water_level.water_level_options = WaterLevelOptions(
            bank=getattr(instance, "bank", "far"),
            length=getattr(instance, "length", 3.0),
            padding=getattr(instance, "padding", 0.5),
            min_z=getattr(instance, "min_z", None),
            max_z=getattr(instance, "max_z", None),
        )
        data.water_level.method = getattr(instance, "wl_get_frames_method", "manmade")
        data.water_level.frames_options = frames_options[data.water_level.method]
        instance.data = data.model_dump()
        return instance


class RecipeCreate(RecipeResponse):
    """Create model for a recipe."""

    # The name is now a requirement
    name: str = Field(description="Free recognizable description of cross section.")
