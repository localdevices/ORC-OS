"""WebSocket video config interactive operations."""

from typing import Any, Dict, Literal, Optional

from fastapi import HTTPException
from pydantic import BaseModel
from pyorc import CameraConfig

from orc_api import UPLOAD_DIRECTORY
from orc_api.schemas.camera_config import CameraConfigData, CameraConfigResponse
from orc_api.schemas.recipe import RecipeResponse
from orc_api.schemas.video import VideoResponse
from orc_api.schemas.video_config import VideoConfigResponse


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
        return f"{self.vc} - saved: {self.saved}"

    def __repr__(self):
        return self.__str__()

    def save(self):
        """Save current state to database."""
        self.saved = True
        # TODO: save to database

    def reset_video_config(self, name: Optional[str] = None):
        """Reset state to default."""
        if self.video.video_config_id is not None:
            # get the name from the original config
            name = self.video.video_config.name
        if name is None:
            raise HTTPException(
                status_code=400, detail='For a new video config, "name" must be provided as query param.'
            )
        vc = VideoConfigResponse(name=name)
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
        return WSVideoResponse(success=True, data=vc.model_dump())

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
            response = getattr(self, op)(**params)
            self.saved = False
            # create ws response instance
            return WSVideoResponse(success=True, data=response.model_dump())
        except Exception as e:
            return WSVideoResponse(success=False, error=str(e))

    def update_cam_config(self, op, **params):
        """Update camera config following an operation."""
        cc = CameraConfig(**self.video.video_config.camera_config.data.model_dump())
        getattr(cc, op)(**params)
        data = CameraConfigData.model_validate(cc.to_dict_str())
        new_cc = CameraConfigResponse(
            name=self.video.video_config.camera_config.name, id=self.video.video_config.camera_config.id, data=data
        )
        self.video.video_config.camera_config = new_cc
        return new_cc

    def get_from_cam_config(self, op, **params):
        """Get output from a CameraConfig operation."""
        cc = CameraConfig(**self.video.video_config.camera_config.data.model_dump())
        return getattr(cc, op)(**params)

    def set_bbox_from_width_length(self, **params):
        """Set bounding box from width and length."""
        return self.update_cam_config("set_bbox_from_width_length", **params)

    def rotate_translate_bbox(self, **params):
        """Resizes bbox according to params."""
        cc_bbox_trans = self.get_from_cam_config("rotate_translate_bbox", **params)
        data = CameraConfigData.model_validate(cc_bbox_trans.to_dict_str())
        new_cc = CameraConfigResponse(
            name=self.video.video_config.camera_config.name, id=self.video.video_config.camera_config.id, data=data
        )
        self.video.video_config.camera_config = new_cc
        return new_cc


class WSVideoResponse(BaseModel):
    """WebSocket response model."""

    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None
