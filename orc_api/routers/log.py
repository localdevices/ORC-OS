"""Log routers."""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from orc_api.log import get_log_files, get_merged_last_lines, stream_new_lines
from orc_api.utils import websockets

router: APIRouter = APIRouter(prefix="/log", tags=["log"])

# start a websockets connection manager
conn_manager = websockets.ConnectionManager()


@router.get("/", response_model=str, status_code=200)
async def get_log(count=500):
    """Retrieve the last amount of lines from the log."""
    files = get_log_files()
    if not any(__import__("os").path.exists(fn) for fn in files):
        raise HTTPException(status_code=404, detail="No log files found!")
    return get_merged_last_lines(files=files, count=count)


@router.websocket("/stream/")
async def stream_log(websocket: WebSocket):
    """Stream new log lines to the frontend in real-time."""
    await conn_manager.connect(websocket)
    print(f"Connected websocket for logging: {websocket}")
    files = get_log_files()
    if not any(__import__("os").path.exists(fn) for fn in files):
        await websocket.close(code=1003, reason="Log files not configured!")
        return
    try:
        await stream_new_lines(websocket, files)  # Stream changes from both files
    except WebSocketDisconnect:
        print(f"Websocket {websocket} disconnected.")
        conn_manager.disconnect(websocket)
