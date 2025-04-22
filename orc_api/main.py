"""Main ORC-OS API module."""

import asyncio
import multiprocessing
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from orc_api import crud
from orc_api.database import get_session
from orc_api.routers import (
    callback_url,
    camera_config,
    device,
    disk_management,
    pivideo_stream,
    settings,
    video,
    video_stream,
    water_level,
)
from orc_api.schemas.disk_management import DiskManagementResponse
from orc_api.schemas.settings import SettingsResponse


def async_job_wrapper(func, kwargs):
    """Wrap call to async functions synchronously, needed for scheduler."""
    asyncio.run(func(**kwargs))  # Run the async function in the event loop


def get_water_level(logger):
    """Get dummy water level for testing the APScheduler API."""
    logger.info(f"Getting water level in daemon mode {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


def schedule_water_level(scheduler, logger, session):
    """Schedule the water level job."""
    # with get_session() as session:
    wl_settings = crud.water_level.get(session)
    if wl_settings:
        logger.info('Water level settings found: setting up interval job "water_level_job"')
        scheduler.add_job(
            func=wl_settings.get_new,
            trigger="interval",
            seconds=wl_settings.frequency,
            start_date=datetime.now() + timedelta(seconds=1),
            id="water_level_job",
            replace_existing=True,
        )
    else:
        logger.info("No water level settings available. If you require water level retrievals, please set this up.")


def schedule_disk_maintenance(scheduler, logger, session):
    """Schedule the disk maintenance."""
    # with get_session() as session:
    dm = crud.disk_management.get(session)
    if dm:
        # validate the settings model instance
        dm_settings = DiskManagementResponse.model_validate(dm)
        logger.info('Disk management settings found: setting up interval job "disk_managemement_job"')
        scheduler.add_job(
            func=dm_settings.cleanup,
            trigger="interval",
            seconds=dm_settings.frequency,
            start_date=datetime.now() + timedelta(seconds=5),
            id="disk_managemement_job",
            replace_existing=True,
        )
    else:
        logger.warning(
            "No disk management settings available. This is risky as your disk may run full and render access to the "
            "OS impossible."
        )


def schedule_video_checker(scheduler, logger, session):
    """Set up check for new videos (runs default every 5 seconds)."""
    # with get_session() as session:
    settings = crud.settings.get(session)
    dm = crud.disk_management.get(session)

    if settings and dm:
        # validate the settings model instance
        settings = SettingsResponse.model_validate(settings)
        dm_settings = DiskManagementResponse.model_validate(dm)
        logger.info('Daemon settings found: setting up interval job "video_check_job"')
        scheduler.add_job(
            func=async_job_wrapper,
            kwargs={
                "func": settings.check_new_videos,
                "kwargs": {"path_incoming": dm_settings.incoming_path, "app": app, "logger": logger},
            },
            trigger="interval",
            seconds=5,
            start_date=datetime.now(),
            id="video_check_job",
            replace_existing=True,
        )
    else:
        logger.info("No daemon settings available, ORC-OS will run interactively only.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the scheduler and logger."""
    from orc_api.log import logger

    logger.info("Starting ORC-OS API")
    scheduler = BackgroundScheduler()
    scheduler.start()
    # add scheduler to api state for use in routers
    app.state.scheduler = scheduler  # scheduler is accessible throughout the app
    app.state.process_list = []  # state with queue of videos to run
    app.state.executor = ThreadPoolExecutor(max_workers=1)
    app.state.processing = False  # state processing yes/no
    with get_session() as session:
        schedule_water_level(scheduler, logger, session)
        schedule_disk_maintenance(scheduler, logger, session)
        schedule_video_checker(scheduler, logger, session)
    yield
    logger.info("Shutting down FastAPI server, goodbye!")


# origins = ["http://localhost:5173"]
origins = ["*"]

# set up API with the lifespan approach, to do things before starting and after closing the API.
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
#

# @app.middleware("http")
# async def log_requests(request, call_next):
#     body = await request.body()
#     logging.info(f"Request headers: {request.headers}")
#     logging.info(f"Request body: {await request.body()}")
#     return await call_next(request)
#

app.include_router(device.router)
app.include_router(settings.router)
app.include_router(callback_url.router)
app.include_router(video.router)
app.include_router(disk_management.router)
app.include_router(water_level.router)
app.include_router(camera_config.router)
app.include_router(video_stream.router)
app.include_router(pivideo_stream.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "You have reached the NodeORC API"}


if __name__ == "__main__":
    multiprocessing.freeze_support()  # For Windows support
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=False, workers=1)
