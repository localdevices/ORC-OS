"""Main ORC-OS API module."""

import asyncio
import multiprocessing
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

import jwt
import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from orc_api import (
    ALGORITHM,
    DEV_MODE,
    INCOMING_DIRECTORY,
    ORC_COOKIE_NAME,
    ORIGINS,
    SECRET_KEY,
    UPLOAD_DIRECTORY,
    crud,
)
from orc_api.database import get_session
from orc_api.db import VideoStatus
from orc_api.routers import (
    auth,
    callback_url,
    camera_config,
    control_points,
    cross_section,
    device,
    disk_management,
    pivideo_stream,
    recipe,
    settings,
    updates,
    video,
    video_config,
    video_stream,
    water_level,
)
from orc_api.schemas.disk_management import DiskManagementResponse
from orc_api.schemas.settings import SettingsResponse
from orc_api.schemas.video import VideoResponse
from orc_api.utils import queue


def verify_token(token: str):
    """Verify a JWT token."""
    # first check for black listing
    try:
        # Decode and validate the token
        _ = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return None
    except jwt.ExpiredSignatureError:
        # Token has expired
        return {"detail": "Token has expired"}
    except jwt.InvalidTokenError:
        # Token is invalid for any reason
        return {"detail": "Token is invalid"}


def auth_token(request: Request):
    """Check if a token is present and verified."""
    token = request.cookies.get(ORC_COOKIE_NAME)
    try:
        if not token:  #  or not token.startswith("Bearer "):
            content = {"detail": "Token missing or not a valid token format"}
        # Verify the token
        # token = token.split("Bearer ")[-1]
        else:
            content = verify_token(token)
        if content is not None:
            return JSONResponse(
                status_code=401,
                content=content,
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("Origin", "*"),
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Credentials": "true",
                },
            )
        else:
            return None

    except HTTPException as e:
        raise e


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
            kwargs={"home_folder": UPLOAD_DIRECTORY},
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

    # settings must be provided AND active
    if settings and dm:
        if settings.active:
            # validate the settings model instance
            settings = SettingsResponse.model_validate(settings)
            logger.info(
                f'Daemon settings found: setting up interval job "video_check_job" with path: {INCOMING_DIRECTORY} '
                f"and file template: {settings.video_file_fmt}"
            )
            scheduler.add_job(
                func=async_job_wrapper,
                kwargs={
                    "func": settings.check_new_videos,
                    "kwargs": {"path_incoming": INCOMING_DIRECTORY, "app": app, "logger": logger},
                },
                trigger="interval",
                seconds=5,
                start_date=datetime.now(),
                id="video_check_job",
                replace_existing=True,
            )
        else:
            # settings found but not yet activated
            logger.info("Daemon settings found, but not activated. Activate the daemon for automated processing.")
    else:
        logger.info("No daemon settings available, ORC-OS will run interactively only.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the scheduler and logger."""
    from orc_api.log import logger

    logger.info("Starting ORC-OS API")
    scheduler = BackgroundScheduler()
    scheduler.start()
    session = get_session()
    # add scheduler to api state for use in routers
    app.state.scheduler = scheduler  # scheduler is accessible throughout the app
    app.state.process_list = []  # state with queue of videos to run
    app.state.executor = ThreadPoolExecutor(max_workers=1)
    app.state.processing = False  # state processing yes/no
    app.state.processing_message = None  # string defining last status condition
    app.state.session = session
    app.state.token_blacklist = set()

    # with get_session() as session:
    schedule_water_level(scheduler, logger, session)
    schedule_disk_maintenance(scheduler, logger, session)
    schedule_video_checker(scheduler, logger, session)
    # finally check if there are any jobs left to do from an earlier occasion
    videos_left = []
    videos_task = crud.video.get_list(session, status=VideoStatus.TASK)
    videos_queue = crud.video.get_list(session, status=VideoStatus.QUEUE)
    videos_left += videos_task
    videos_left += videos_queue
    if len(videos_left) > 0:
        logger.info(f"There are {len(videos_left)} videos left to process from earlier work.")
        for video_rec in videos_left:
            with get_session() as db:
                # ensure state is set back to new so that processing will be accepted.
                db.commit()
                # session.refresh(video_rec)
                video_rec = crud.video.update(db, video_rec.id, {"status": VideoStatus.NEW})
                video = VideoResponse.model_validate(video_rec)
            if video.ready_to_run[0]:
                _ = await queue.process_video_submission(
                    session=session,
                    video=video,
                    logger=logger,
                    executor=app.state.executor,
                    upload_directory=UPLOAD_DIRECTORY,
                )
    else:
        logger.info("No videos left to process from earlier work.")

    yield
    logger.info("Shutting down FastAPI server, goodbye!")


# set up API with the lifespan approach, to do things before starting and after closing the API.
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,  # origins, dynamically set later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def add_csp_header(request, call_next):
    """Add Content-Security-Policy header to all responses."""
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "connect-src 'self' ws://localhost:5000/"
    return response


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Check if end point requires token verification or not. First validate, then retrieve end point."""
    # Skip authentication check when DEV_MODE is enabled
    if DEV_MODE:
        return await call_next(request)

    # login by def. does not require a token as it should return a token
    if request.url.path in ["/auth/login", "/auth/password_available"]:
        return await call_next(request)

    # case where no password yet exists and password store is requested also does not require auth
    if request.url.path in ["/auth/set_password"]:
        # Check if any password exists in database
        has_password = crud.login.get(request.app.state.session) is not None
        if not has_password:
            # if not, then a password may be set
            return await call_next(request)

    # No exceptions occurring, so first apply normal authentication for production and other environments
    r = auth_token(request)
    # r should be None if all is good and then forward to request will be performed. Otherwise a response is returned.
    if r is not None:
        return r

    return await call_next(request)


#

# @app.middleware("http")
# async def log_requests(request, call_next):
#     body = await request.body()
#     logging.info(f"Request headers: {request.headers}")
#     logging.info(f"Request body: {await request.body()}")
#     return await call_next(request)
#
app.include_router(callback_url.router)
app.include_router(camera_config.router)
app.include_router(control_points.router)
app.include_router(cross_section.router)
app.include_router(device.router)
app.include_router(disk_management.router)
app.include_router(pivideo_stream.router)
app.include_router(recipe.router)
app.include_router(auth.router)
app.include_router(settings.router)
app.include_router(updates.router)
app.include_router(video.router)
app.include_router(video_config.router)
app.include_router(video_stream.router)
app.include_router(water_level.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "You have reached the ORC-OS API"}


@app.get("/no-access")
async def no_access():
    """Refuse access to user."""
    print("GIVING NO ACCESS")
    return HTTPException(status_code=401, detail="No access")


if __name__ == "__main__":
    multiprocessing.freeze_support()  # For Windows support
    uvicorn.run("orc_api.main:app", host="0.0.0.0", port=5000, reload=False, workers=1)
