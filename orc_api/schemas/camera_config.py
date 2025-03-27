from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import warnings

# Alternatively, print traceback for warnings without halting execution
warnings.simplefilter("always", DeprecationWarning)

# Pydantic model for responses
class CameraConfigBase(BaseModel):
    name: Optional[str] = Field(default=None, description="Name of the device.")
    config: Optional[dict] = Field(default=None, description="Camera configuration")

class CameraConfigResponse(CameraConfigBase):
    id: int = Field(description="Camera configuration ID")

    model_config = ConfigDict(from_attributes=True)
    # class Config:
    #     from_attributes = True

class CameraConfigCreate(CameraConfigBase):
    pass

class CameraConfigUpdate(BaseModel):
    name: Optional[str]
    config: Optional[dict]

class GCPs(BaseModel):
    src: List[List[float]]  # src list of points in objective (e.g., [[col1, row1], [col2, row2]])
    dst: List[List[Optional[float]]]  # dst list of points in real-world [[x1, y1], [x2, y2], [x3, y3]]
    crs: Optional[str]  # Coordinate Reference System as a string
    height: float
    width: float


class FittedPoints(BaseModel):
    src_est: List[List[float]]
    dst_est: List[List[float]]
    camera_matrix: List[List[float]]
    dist_coeffs: List[List[float]]
    rvec: List[List[float]]
    tvec: List[List[float]]
    error: float