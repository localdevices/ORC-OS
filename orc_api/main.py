"""Main ORC-OS API module."""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta

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


def get_water_level(logger):
    """Get dummy water level for testing the APScheduler API."""
    logger.info(f"Getting water level in daemon mode {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


def schedule_water_level(scheduler, logger):
    """Schedule the water level job."""
    wl_settings = crud.water_level.get(get_session())
    if wl_settings:
        logger.info('Water level settings found: setting up interval job "water_level_job"')
        scheduler.add_job(
            func=wl_settings.get_new,
            trigger="interval",
            seconds=wl_settings.frequency,
            start_date=datetime.now() + timedelta(seconds=5),
            id="water_level_job",
            replace_existing=True,
        )
    else:
        logger.info("No water level settings found, skipping interval job setup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the scheduler and logger."""
    from orc_api.log import logger

    logger.info("Starting ORC-OS API")
    scheduler = BackgroundScheduler()
    scheduler.start()
    # add scheduler to api state for use in routers
    app.state.scheduler = scheduler
    schedule_water_level(scheduler, logger)
    yield
    logger.info("Shutting down FastAPI server, goodbye!")


# origins = ["http://localhost:5173"]
origins = ["*"]

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
