"""WebSocket video config interactive operations."""

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel
from pyorc import CameraConfig

from orc_api.schemas.camera_config import CameraConfigData, CameraConfigResponse
from orc_api.schemas.video_config import VideoConfigResponse


class WSVideoConfigMsg(BaseModel):
    """WebSocket message model.

    Defines the structure of messages sent to the client via WebSocket.

    Parameters
    ----------
    action : Literal["save", "update", "reset"]
        Defines the type of message.
        "save" indicates that the current state of the video config should be saved to database
        "update" indicates that the video config should be updated using a specified action and required parameters.
        Update may either return None or an output as pydantic model instance.
        "reset" indicates that the video config should be reset to a default state without details.
    op : str
        name of the operation to be performed (ignored with reset and save)
    params : additional parameters required for operation (ignored with reset and save).

    """

    action: Literal["save", "update", "reset"]
    op: str = None
    params: Optional[Dict] = None


class WSVideoConfigState(BaseModel):
    """WebSocket state for current video config."""

    vc: VideoConfigResponse
    saved: bool = False

    def __str__(self):
        return f"{self.vc} - saved: {self.saved}"

    def __repr__(self):
        return self.__str__()

    def save(self):
        """Save current state to database."""
        self.saved = True
        # TODO: save to database

    def reset(self):
        """Reset state to default."""
        # TODO: implement reset
        self.saved = False

    def update(self, op: str, params: Optional[Dict] = None) -> Optional[Any]:
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
            return WSVideoConfigResponse(success=True, data=response.model_dump())
        except Exception as e:
            return WSVideoConfigResponse(success=False, error=str(e))

    def update_cam_config(self, op, **params):
        """Update camera config following an operation."""
        cc = CameraConfig(**self.vc.camera_config.data.model_dump())
        getattr(cc, op)(**params)
        data = CameraConfigData.model_validate(cc.to_dict_str())
        new_cc = CameraConfigResponse(name=self.vc.camera_config.name, id=self.vc.camera_config.id, data=data)
        self.vc.camera_config = new_cc
        return new_cc

    def get_from_cam_config(self, op, **params):
        """Get output from a CameraConfig operation."""
        cc = CameraConfig(**self.vc.camera_config.data.model_dump())
        return getattr(cc, op)(**params)

    def set_bbox_from_width_length(self, **params):
        """Set bounding box from width and length."""
        return self.update_cam_config("set_bbox_from_width_length", **params)

    def rotate_translate_bbox(self, **params):
        """Resizes bbox according to params."""
        cc_bbox_trans = self.get_from_cam_config("rotate_translate_bbox", **params)
        data = CameraConfigData.model_validate(cc_bbox_trans.to_dict_str())
        new_cc = CameraConfigResponse(name=self.vc.camera_config.name, id=self.vc.camera_config.id, data=data)
        self.vc.camera_config = new_cc
        return new_cc


class WSVideoConfigResponse(BaseModel):
    """WebSocket response model."""

    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None
