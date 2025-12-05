"""Main ORC-OS API module."""

import asyncio
import multiprocessing
import time
from contextlib import asynccontextmanager

import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from orc_api import (
    DEV_MODE,
    ORIGINS,
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
    log,
    pivideo_stream,
    recipe,
    settings,
    updates,
    video,
    video_config,
    video_stream,
    water_level,
)
from orc_api.schedulers import (
    delayed_sync_videos,
    schedule_disk_maintenance,
    schedule_video_checker,
    schedule_water_level,
)
from orc_api.schemas.video import VideoResponse
from orc_api.utils import auth_helpers, queue
from orc_api.utils.states import video_run_state


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
    app.state.executor = queue.PriorityThreadPoolExecutor(max_workers=1)  # ThreadPoolExecutor(max_workers=1)
    # app.state.processing = False  # state processing yes/no
    app.state.video_run_state = video_run_state  # initialize video run status queue
    # app.state.processing_message = None  # string defining last status condition
    app.state.session = session
    app.state.start_time = time.time()

    schedule_water_level(scheduler, logger, session)
    schedule_disk_maintenance(scheduler, logger, session)

    # delay syncing of non-synced videos to ensure any video jobs for daemon are always prioritized
    asyncio.create_task(delayed_sync_videos(app, logger))

    process_queue_videos = schedule_video_checker(scheduler, logger, session, app)
    if process_queue_videos:
        # finally check if there are any jobs left to do from an earlier occasion
        videos_left = []
        videos_task = crud.video.get_list(session, status=VideoStatus.TASK)
        videos_queue = crud.video.get_list(session, status=VideoStatus.QUEUE)
        videos_left += videos_task
        videos_left += videos_queue
        if len(videos_left) > 0:
            logger.info(f"There are {len(videos_left)} videos left to process from earlier work.")
            for video_rec in videos_left:
                # with get_session() as db:
                # ensure state is set back to new so that processing will be accepted.
                # db.commit()
                # session.refresh(video_rec)
                video_rec = crud.video.update(session, video_rec.id, {"status": VideoStatus.NEW})
                video_instance = VideoResponse.model_validate(video_rec)
                if video_instance.ready_to_run[0]:
                    _ = await queue.process_video(
                        session=session,
                        video=video_instance,
                        logger=logger,
                        executor=app.state.executor,
                        upload_directory=UPLOAD_DIRECTORY,
                    )
        else:
            logger.info("No videos left to process from earlier work.")
    else:
        logger.info("Daemon active and set to shutdown after task. Earlier videos will NOT be processed.")

    yield
    logger.info("Shutting down FastAPI server, goodbye!")


# set up API with the lifespan approach, to do things before starting and after closing the API.
app = FastAPI(lifespan=lifespan, root_path="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,  # origins, dynamically set later
    allow_credentials=True,
    allow_methods=["*"],  # ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],# ["*"],
    allow_headers=["*"],  # ["X-PINGOTHER", "Content-Type"],# ["*"],
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

    # preflight requests are always passed through and never get cookies attached
    if request.method == "OPTIONS":
        return await call_next(request)

    # login by def. does not require a token as it should return a token
    if request.url.path in ["/api/auth/login/", "/api/auth/password_available/"]:
        return await call_next(request)

    # case where no password yet exists and password store is requested also does not require auth
    if request.url.path in ["/api/auth/set_password/"]:
        # Check if any password exists in database
        has_password = crud.login.get(request.app.state.session) is not None
        if not has_password:
            # if not, then a password may be set
            return await call_next(request)

    # No exceptions occurring, so first apply normal authentication for production and other environments
    r = auth_helpers.auth_token(request)
    # r should be None if all is good and then forward to request will be performed. Otherwise a response is returned.
    if r is not None:
        return r

    return await call_next(request)


#
#
# @app.middleware("http")
# async def log_requests(request, call_next):
#     body = await request.body()
#     print(f"Request headers: {request.headers}")
#     print(f"Request body: {await request.body()}")
#     return await call_next(request)

app.include_router(callback_url.router)
app.include_router(camera_config.router)
app.include_router(control_points.router)
app.include_router(cross_section.router)
app.include_router(device.router)
app.include_router(disk_management.router)
app.include_router(log.router)
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
    return HTTPException(status_code=401, detail="No access")


if __name__ == "__main__":
    multiprocessing.freeze_support()  # For Windows support
    uvicorn.run("orc_api.main:app", host="0.0.0.0", port=5000, reload=False, workers=1)
