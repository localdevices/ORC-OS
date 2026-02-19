"""Database models for NodeORC."""

import os
import sqlite3

from sqlalchemy import create_engine, event, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from orc_api import __home__

from .base import Base, RemoteBase, SyncStatus
from .callback_url import CallbackUrl
from .camera_config import CameraConfig
from .cross_section import CrossSection
from .device import Device, DeviceFormStatus, DeviceStatus
from .disk_management import DiskManagement
from .password import Password
from .recipe import Recipe
from .service import Service, ServiceParameter
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
    "Service",
    "ServiceParameter",
    "Device",
    "DeviceFormStatus",
    "DeviceStatus",
    "DiskManagement",
    "Password",
    "Recipe",
    "Settings",
    "TimeSeries",
    "SyncStatus",
    "Video",
    "VideoConfig",
    "VideoStatus",
    "WaterLevelSettings",
    "ScriptType",
]

db_path_config = os.path.join(__home__, "orc-os.db")
sqlite_engine = f"sqlite:///{db_path_config}"
engine_config = create_engine(sqlite_engine, connect_args={"check_same_thread": False})


# make sure that foreign keys are recognized and foreign key constraints handled
@event.listens_for(Engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, _):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


Session = sessionmaker(autocommit=False, autoflush=False, bind=engine_config)
session = Session()

# Check if Device table exists and create device if needed
inspector = inspect(engine_config)
if "device" in inspector.get_table_names():
    try:
        device_query = session.query(Device)
        if len(device_query.all()) == 0:
            device = Device()
            session.add(device)
            session.commit()
    except Exception as e:
        session.rollback()
        raise Exception(f"Error checking/creating device: {str(e)}")
