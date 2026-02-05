"""WebSocket video config interactive operations."""

import traceback
from typing import Any, Dict, Literal, Optional

import numpy as np
from pydantic import BaseModel
from pyorc import CameraConfig

from orc_api import DEV_MODE, UPLOAD_DIRECTORY, crud
from orc_api.database import get_session
from orc_api.db.base import SyncStatus
from orc_api.schemas.camera_config import CameraConfigData, CameraConfigResponse, CameraConfigUpdate
from orc_api.schemas.cross_section import CrossSectionResponseCameraConfig
from orc_api.schemas.recipe import RecipeResponse, RecipeUpdate
from orc_api.schemas.video import VideoResponse, VideoUpdate
from orc_api.schemas.video_config import VideoConfigUpdate


def update_nested(obj, patch: Dict):
    """Update nested pydantic model fields recursively from a dictionary."""
    for key, value in patch.items():
        if isinstance(value, dict) and hasattr(obj, key):
            # If value is a dict and the attribute exists, recurse into it
            nested_obj = getattr(obj, key)
            if nested_obj is not None:
                update_nested(nested_obj, value)
            else:
                # If nested object is None, set the dict directly
                setattr(obj, key, value)
        else:
            # Leaf value - set it directly
            setattr(obj, key, value)


class WSVideoMsg(BaseModel):
    """WebSocket message model.

    Defines the structure of messages sent to the client via WebSocket.

    Parameters
    ----------
    action : Literal["save", "update", "reset"]
        Defines the type of message.
        "save" indicates that the current state of the video config should be saved to database
        "update_video_config" indicates that the video config should be updated using a specified action and
        required parameters.
        Update may either return None or an output as pydantic model instance.
        "reset_video_config" indicates that the video config should be reset to a default state without details.
    op : str
        name of the operation to be performed (ignored with reset and save)
    params : additional parameters required for operation (ignored with reset and save).

    """

    action: Literal["save", "update_video_config", "reset_video_config"]
    op: str = None
    params: Optional[Dict] = None


class WSVideoState(BaseModel):
    """WebSocket state for current video config.

    This state gets updated with each message received from the client.
    It is used during the Video Configuration process on the web front end.

    """

    video: VideoResponse
    saved: bool = False

    def __str__(self):
        return f"{self.video} - saved: {self.saved}"

    def __repr__(self):
        return self.__str__()

    @property
    def submodel_bbox(self) -> Dict:
        """Return dict with submodel, typical for changing a parameter that alters the bbox and/or projected bbox."""
        model_dict = {
            "video_config": {
                "camera_config": {
                    "bbox": self.video.video_config.camera_config.bbox,
                    "bbox_camera": self.video.video_config.camera_config.bbox_camera,
                    "gcps": self.video.video_config.camera_config.gcps,
                }
            }
        }
        if self.video.video_config.cross_section is not None:
            if self.video.video_config.cross_section.bbox_wet is not None:
                model_dict["video_config"]["cross_section"] = {
                    "bbox_wet": self.video.video_config.cross_section.bbox_wet
                }
            else:
                model_dict["video_config"]["cross_section"] = {"bbox_wet": []}
        return model_dict

    def _inherit_name(self, attr):
        if getattr(self.video.video_config, attr) is not None and getattr(self.video.video_config, attr).name is None:
            # set name to same value
            getattr(self.video.video_config, attr).name = self.video.video_config.name

    def _get_cs_rec(self, cs_id: int, camera_config: Optional[CameraConfigResponse] = None):
        with get_session() as db:
            cs_rec = crud.cross_section.get(db=db, id=cs_id)
            # add camera config
        cs_rec.camera_config = CameraConfigResponse.model_validate(
            camera_config or self.video.video_config.camera_config
        )
        cs_rec = CrossSectionResponseCameraConfig.model_validate(cs_rec)
        # check within image
        if not cs_rec.within_image:
            raise ValueError(f"Cross section {cs_id} is not within image bounds.")
        if cs_rec.distance_camera > 1000:
            raise ValueError(f"Cross section {cs_id} is too far away from the camera (> 1000 m.)")
        return cs_rec

    def get_from_cam_config(self, op, **params):
        """Get output from a CameraConfig operation."""
        cc = CameraConfig(**self.video.video_config.camera_config.data.model_dump())
        return getattr(cc, op)(**params)

    def save(self, name=None):
        """Save current state to database."""
        try:
            video_config = self.video.video_config
            if video_config is None:
                return WSVideoResponse(success=False, message="No video config to save. Make a new config first.")
            if name is not None:
                video_config.name = name
            if video_config.name is None:
                return WSVideoResponse(success=False, message="No name provided for video config, and no name set yet.")
            # also check subcomponents for name values, inherit from parent if not set
            attrs = ["recipe", "camera_config", "cross_section", "cross_section_wl"]
            for attr in attrs:
                self._inherit_name(attr=attr)
            if video_config.sample_video_id is None:
                video_config.sample_video_id = self.video.id
            if video_config.sync_status != SyncStatus.LOCAL:
                # set sync status to updated, so that it is clear it must be (re)synced
                video_config.sync_status = SyncStatus.UPDATED
                if video_config.recipe is not None:
                    video_config.recipe.sync_status = SyncStatus.UPDATED
                if video_config.camera_config is not None:
                    video_config.camera_config.sync_status = SyncStatus.UPDATED
                if video_config.cross_section is not None:
                    video_config.cross_section.sync_status = SyncStatus.UPDATED
                if video_config.cross_section_wl is not None:
                    video_config.cross_section_wl.sync_status = SyncStatus.UPDATED
            with get_session() as db:
                self.video.video_config = video_config.patch_post(db=db)
                # check if video has a video_config. If not set to current
                if self.video.video_config_id is None:
                    self.video.video_config_id = self.video.video_config.id
                self.video = self.video.patch_post(db=db)

            self.saved = True
            return WSVideoResponse(
                success=True,
                video={"video_config": self.video.video_config.model_dump()},  # return only video_config
                saved=self.saved,
                message="Video configuration saved successfully",
            )
        except Exception as e:
            traceback.print_exc()
            return WSVideoResponse(success=False, message=str(e))

    def update_video_config(self, op: str, params: Optional[Dict] = None) -> Optional[Any]:
        """Execute operation for updating, passing optional parameters.

        Returns a structured response encapsulating the result or error details.

        The response from any operation must be a pydantic model instance.

        Parameters
        ----------
        op : str
            The name of the operation to be performed. It should correspond to a callable
            method within the current instance.
        params : dict, optional
            A dictionary of parameters to be passed to the operation. If not provided,
            an empty dictionary will be used.

        Returns
        -------
        WSResponse
            If the operation is successful, returns a WSResponse instance with success set to
            True and data containing the serialized response. In case of failure, returns
            a WSResponse instance with success set to False and error containing the error
            message.

        Raises
        ------
        None

        """
        if params is None:
            params = {}
        try:
            result = getattr(self, op)(**params)
            self.saved = False
            if isinstance(result, tuple):
                if len(result) > 2:
                    return WSVideoResponse(success=False, message=f"Operation {op} returned more than 2 values.")
                response, msg = result
            else:
                response = result
                msg = None

            # create ws response instance
            return WSVideoResponse(success=True, video=response, message=msg)
        except Exception as e:
            if DEV_MODE:
                traceback.print_exc()
            return WSVideoResponse(success=False, message=str(e), saved=self.saved)

    def update_cross_section(self, cross_section_id: Optional[int] = None, cross_section_wl_id: Optional[int] = None):
        """Update cross-section for discharge or water level using its id."""
        cs_dict = {}
        msg = ""
        if cross_section_id is not None:
            # special case if id is zero, then set to null
            if cross_section_id == 0:
                self.video.video_config.cross_section = None
                self.video.video_config.cross_section_id = None
                cs_dict["cross_section_id"] = None
                cs_dict["cross_section"] = None
                msg += "Discharge cross section set to None"
            else:
                cs_rec = self._get_cs_rec(cross_section_id)
                self.video.video_config.cross_section_id = cross_section_id
                # also (re)populate cross_section_wl fields
                self.video.video_config.cross_section = cs_rec
                cs_dict["cross_section_id"] = cross_section_id
                cs_dict["cross_section"] = cs_rec
                msg += f"Discharge cross section updated to {cross_section_id}"

        if cross_section_wl_id is not None:
            # special case of zero
            if cross_section_wl_id == 0:
                self.video.video_config.cross_section_wl_id = None
                self.video.video_config.cross_section_wl = None
                cs_dict["cross_section_wl_id"] = None
                cs_dict["cross_section_wl"] = None

                if len(msg) > 0:
                    msg += " and water level cross section set to None"
                else:
                    msg += "Water level cross section set to None"
            else:
                cs_rec = self._get_cs_rec(cross_section_wl_id)
                self.video.video_config.cross_section_wl_id = cross_section_wl_id
                # also (re)populate cross_section_wl fields
                self.video.video_config.cross_section_wl = cs_rec
                cs_dict["cross_section_wl_id"] = cross_section_wl_id
                cs_dict["cross_section_wl"] = cs_rec
                if len(msg) > 0:
                    msg += f" and water level cross section updated to {cross_section_wl_id}"
                else:
                    msg += f"Water level cross section updated to {cross_section_wl_id}"
        return {"video_config": cs_dict}, msg

    def update_water_level(self, z_0=None, h_ref=None):
        """Update water levels in camera config, removing fields that cannot be resolved without water level."""
        cam_config = self.video.video_config.camera_config
        if z_0 is None:
            # h_ref cannot exist when z_0 does not exist
            h_ref = None
            cam_config.data.bbox = None
            self.video.video_config.cross_section = None
            self.video.video_config.cross_section_id = None
            self.video.video_config.cross_section_wl = None
            self.video.video_config.cross_section_wl_id = None
        cam_config.data.gcps.h_ref = h_ref
        cam_config.data.gcps.z_0 = z_0
        self.video.video_config.camera_config = cam_config
        # create new camera config from data, with set bboxes with new z_0
        return self.set_bbox()

    def update_cam_config(self, op, **params):
        """Update camera config following an operation."""
        cc = CameraConfig(**self.video.video_config.camera_config.data.model_dump())
        getattr(cc, op)(**params)
        data = CameraConfigData.model_validate(cc.to_dict_str())
        new_cc = CameraConfigResponse(
            name=self.video.video_config.camera_config.name, id=self.video.video_config.camera_config.id, data=data
        )
        self.set_field(
            video_patch={
                "video_config": {
                    "camera_config": new_cc,
                }
            }
        )

        self.video.video_config.camera_config = new_cc
        return new_cc

    def update_recipe(self, recipe_patch: Optional[Dict] = None) -> Dict:
        """Update recipe fields."""
        # make ready for updating
        if recipe_patch is None or recipe_patch == {}:
            return {}
        recipe_update = RecipeUpdate.model_validate(self.video.video_config.recipe)
        update_nested(recipe_update, recipe_patch)
        recipe_update = RecipeUpdate.model_validate(recipe_update)
        self.video.video_config.recipe = RecipeResponse.model_validate(recipe_update)
        return {"video_config": {"recipe": self.video.video_config.recipe.model_dump()}}

    def set_rotation(self, **params):
        """Set rotation of camera config."""
        if "rotation" not in params:
            return WSVideoResponse(success=False, error='Missing "rotation" parameter.')
        self.video.video_config.camera_config.rotation = params["rotation"]
        # get new height/width from rotation
        self.video.video_config.camera_config.height, self.video.video_config.camera_config.width = self.video.dims(
            base_path=UPLOAD_DIRECTORY
        )
        # reset .data field
        self.video.video_config.camera_config = CameraConfigUpdate.model_validate(self.video.video_config.camera_config)
        return {
            "video_config": {
                "camera_config": {
                    "height": self.video.video_config.camera_config.height,
                    "width": self.video.video_config.camera_config.width,
                    "rotation": self.video.video_config.camera_config.rotation,
                    "data": self.video.video_config.camera_config.data.model_dump(),
                }
            }
        }, "rotation of video modified"

    def set_bbox(self, op=None, inplace=True, **params):
        """Set bbox-related camera config properties."""
        cc = CameraConfig(**self.video.video_config.camera_config.data.model_dump())
        # perform operation
        if op is not None:
            if inplace:
                # operation sets property
                getattr(cc, op)(**params)
            else:
                # operation returns new instance
                cc = getattr(cc, op)(**params)
        data = CameraConfigData.model_validate(cc.to_dict_str())
        new_cc = CameraConfigResponse(
            name=self.video.video_config.camera_config.name, id=self.video.video_config.camera_config.id, data=data
        )
        # also update cross section for wet_bbox
        cs = self.video.video_config.cross_section
        if cs is not None and cs.camera_config is not None:
            # also update the wetted bbox.
            cs.camera_config = new_cc
            # directly obtain z from the cam config
            z = cc.gcps["z_0"]
            h = cc.gcps["h_ref"]
            if z <= np.array(cs.obj.z).max() and z > np.array(cs.obj.z).min():
                cs.water_lines = cs.get_csl_line(h=h, length=2.0, offset=0.0, camera=True)
                cs.bbox_wet = cs.get_bbox_dry_wet(h=h)
            else:
                cs.water_lines = []
                cs.bbox_wet = []
            self.video.video_config.cross_section = cs
        if (
            self.video.video_config.cross_section_wl is not None
            and self.video.video_config.cross_section_wl.camera_config is not None
        ):
            self.video.video_config.cross_section_wl.camera_config = new_cc
        self.video.video_config.camera_config = new_cc
        # new_cc = self.update_cam_config("set_bbox_from_width_length", **params)
        return self.submodel_bbox

    def set_bbox_from_width_length(self, **params):
        """Set bounding box from width and length."""
        self.set_bbox("set_bbox_from_width_length", **params)
        return self.submodel_bbox

    def set_field(self, video_patch: Optional[Dict] = None, update=False) -> Dict:
        """Set a field within self.video model instance, following the dictionary structure of the video_patch input.

        Parameters
        ----------
        video_patch : dict, optional
            content of video to be updated in dictionary format, following the structure of the video model.
        update : bool, optional
            If set, CameraConfig and Recipe will be converted into CameraConfigUpdate and RecipeUpdate instances
            whereby fields are updated from the `data` property of the CameraConfigResponse and RecipeResponse
            instances.

        """
        if video_patch is None:
            return {}

        # make ready for updating
        video_update = VideoUpdate.model_validate(self.video)
        update_nested(video_update, video_patch)
        # set to Response or Update instances if update=False/True
        if update:
            video_update.video_config.camera_config = CameraConfigUpdate.model_validate(
                video_update.video_config.camera_config.model_dump(exclude={"data"})
            )
            video_update.video_config.recipe = RecipeUpdate.model_validate(
                video_update.video_config.recipe.model_dump(exclude={"data"})
            )
            if video_update.video_config.cross_section_id is not None:
                cs_rec = self._get_cs_rec(
                    video_update.video_config.cross_section_id, camera_config=video_update.video_config.camera_config
                )
                # re-populate cross_section_wl fields, e.g. to update bbox_camera and cross section after h change
                video_update.video_config.cross_section = cs_rec
            if video_update.video_config.cross_section_wl_id is not None:
                cs_rec = self._get_cs_rec(
                    video_update.video_config.cross_section_wl_id, camera_config=video_update.video_config.camera_config
                )
                # re-populate cross_section_wl fields, e.g. to update bbox_camera and cross section after h change
                video_update.video_config.cross_section_wl = cs_rec
        else:
            video_update.video_config.camera_config = CameraConfigUpdate.model_validate(
                video_update.video_config.camera_config
            )
            video_update.video_config.recipe = RecipeUpdate.model_validate(video_update.video_config.recipe)
        # force video into a response model again
        self.video = VideoResponse.model_validate(video_update.model_dump())
        return self.video.model_dump()

    def reset_bbox(self):
        """Reset bounding box from width and length."""
        cc = self.video.video_config.camera_config
        # strip all bbox related things
        cc.data.bbox = None
        cc.bbox = []
        cc.bbox_camera = []
        self.video.video_config.camera_config = cc
        if self.video.video_config.cross_section is not None:
            self.video.video_config.cross_section.camera_config = cc
            self.video.video_config.cross_section.bbox_wet = []
        if self.video.video_config.cross_section_wl is not None:
            self.video.video_config.cross_section_wl.camera_config = cc
        return self.submodel_bbox

    def reset_video_config(self, name: Optional[str] = None):
        """Reset state to default."""
        if self.video.video_config_id is not None:
            # get the name from the original config
            name = self.video.video_config.name
        vc = VideoConfigUpdate(name=name)
        # check if recipe is None, if so make a default recipe
        if vc.recipe is None:
            frame_count = self.video.frame_count(base_path=UPLOAD_DIRECTORY)
            vc.recipe = RecipeResponse(name=vc.name, end_frame=frame_count)
        if vc.camera_config is None:
            # initialize camera config with default values
            height, width = self.video.dims(base_path=UPLOAD_DIRECTORY)
            vc.camera_config = CameraConfigResponse(name=vc.name, data={"height": height, "width": width})
        self.video.video_config = vc
        self.saved = False
        return WSVideoResponse(
            success=True,
            video=self.video.model_dump(),
            saved=self.saved,
        )

    def rotate_translate_bbox(self, **params):
        """Resizes bbox according to params."""
        self.set_bbox("rotate_translate_bbox", **params, inplace=False)
        return self.submodel_bbox


class WSVideoResponse(BaseModel):
    """WebSocket response model."""

    success: bool = True
    saved: bool = False
    video: Optional[Dict] = None  # contains either full video, or only those parts of the video structure to update
    message: Optional[str] = None
