"""Schemas for ORC-OS."""

import importlib

# TYPE_CHECKING used to import everything in IDEs or tests
from typing import TYPE_CHECKING

__all__ = [
    "callback_url",
    "camera_config",
    "cross_section",
    "device",
    "disk_management",
    "settings",
    "service",
    "video",
    "video_config",
    "water_level",
]

if TYPE_CHECKING:
    from . import (
        callback_url,
        camera_config,
        cross_section,
        device,
        disk_management,
        service,
        settings,
        video,
        video_config,
        water_level,
    )  # noqa: F401


def __getattr__(name):
    """Import submodules lazily, so light processes (celery) do not load pyorc and friends via this package."""
    if name in __all__:
        return importlib.import_module(f"{__name__}.{name}")
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
