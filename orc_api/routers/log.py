"""Log routers."""

from logging import FileHandler
from logging.handlers import RotatingFileHandler

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from orc_api.log import get_last_lines, logger, stream_new_lines
from orc_api.utils import websockets

router: APIRouter = APIRouter(prefix="/log", tags=["log"])

# start a websockets connection manager
conn_manager = websockets.ConnectionManager()


@router.get("/", response_model=str, status_code=200)
async def get_log(count=500):
    """Retrieve the last amount of lines from the log."""
    if not logger.handlers or len(logger.handlers) < 2:
        raise HTTPException(status_code=500, detail="Log file handler not found!")
    handler = logger.handlers[1]
    if not isinstance(handler, FileHandler) or not isinstance(handler, RotatingFileHandler):
        raise HTTPException(status_code=500, detail="Log file handler is not a FileHandler!")
    fn = handler.baseFilename
    try:
        string = get_last_lines(fn=fn, count=count)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Log file not found!")
    return string


@router.websocket("/stream/")
async def stream_log(websocket: WebSocket):
    """Stream new log lines to the frontend in real-time."""
    await conn_manager.connect(websocket)
    print(f"Connected websocket for logging: {websocket}")
    if not logger.handlers or len(logger.handlers) < 2:
        await websocket.close(code=1003, reason="Log file handler not found!")
        return
    handler = logger.handlers[1]
    if not isinstance(handler, FileHandler) or not isinstance(handler, RotatingFileHandler):
        await websocket.close(code=1003, reason="Log file handler is not a FileHandler!")
        return
    fn = handler.baseFilename
    if fn is None:
        await websocket.close(code=1003, reason="Log file not found!")
        return
    try:
        await stream_new_lines(websocket, fn)  # Stream changes from the file
    except WebSocketDisconnect:
        print(f"Websocket {websocket} disconnected.")
        conn_manager.disconnect(websocket)
