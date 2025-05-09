"""Database models for NodeORC."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from orc_api import __home__

from .base import Base, RemoteBase, SyncStatus
from .callback_url import CallbackUrl
from .camera_config import CameraConfig
from .cross_section import CrossSection
from .device import Device, DeviceFormStatus, DeviceStatus
from .disk_management import DiskManagement
from .recipe import Recipe
from .settings import Settings
from .time_series import TimeSeries
from .video import Video, VideoStatus
from .video_config import VideoConfig
from .water_level_settings import ScriptType, WaterLevelSettings

__all__ = [
    "Base",
    "RemoteBase",
    "CallbackUrl",
    "CameraConfig",
    "CrossSection",
    "Device",
    "DeviceFormStatus",
    "DeviceStatus",
    "DiskManagement",
    "Recipe",
    "TimeSeries",
    "Settings",
    "SyncStatus",
    "Video",
    "VideoConfig",
    "VideoStatus",
    "WaterLevelSettings",
    "ScriptType",
]

db_path_config = os.path.join(__home__, "orc-os.db")
engine_config = create_engine(f"sqlite:///{db_path_config}", connect_args={"check_same_thread": False})

# make the models
Base.metadata.create_all(engine_config)

Session = sessionmaker(autocommit=False, autoflush=False, bind=engine_config)
# Session.configure(bind=engine_config)
session = Session()

# if no device id is present, then create one
device_query = session.query(Device)
if len(device_query.all()) == 0:
    device = Device()
    session.add(device)
    session.commit()
