from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware

from nodeorc_api.routers import device, video, disk_management, water_level
app = FastAPI()

# origins = ["http://localhost:5173"]
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(device.router)
app.include_router(video.router)
app.include_router(disk_management.router)
app.include_router(water_level.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}


