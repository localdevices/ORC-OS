from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pyorc.cli.main import camera_config

from orc_api.routers import device, settings, video_stream, video, disk_management, water_level, pivideo_stream, camera_config, callback_url
app = FastAPI()
# import logging
# logging.basicConfig(level=logging.INFO)


# origins = ["http://localhost:5173"]
origins = ["*"]

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
    return {"message": "You have reached the NodeORC API"}


