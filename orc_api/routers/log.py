"""Log routers."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from orc_api.log import get_last_lines, logger, stream_new_lines
from orc_api.utils import websockets

router: APIRouter = APIRouter(prefix="/log", tags=["log"])

# start a websockets connection manager
conn_manager = websockets.ConnectionManager()


@router.get("/", response_model=str, status_code=200)
async def get_log(count=1000):
    """Retrieve the last amount of lines from the log."""
    fn = logger.handlers[1].baseFilename
    return get_last_lines(fn=fn, count=count)


@router.websocket("/stream/")
async def stream_log(websocket: WebSocket):
    """Stream new log lines to the frontend in real-time."""
    await conn_manager.connect(websocket)
    print(f"Connected websocket for logging: {websocket}")
    fn = logger.handlers[1].baseFilename

    if fn is None:
        await websocket.close(code=1003, reason="Log file not found!")
        return
    try:
        await stream_new_lines(websocket, fn)  # Stream changes from the file
    except WebSocketDisconnect:
        print(f"Websocket {websocket} disconnected.")
        conn_manager.disconnect(websocket)
    # finally:
    #     try:
    #         conn_manager.disconnect(websocket)
    #         if not websocket.client_state == WebSocketState.DISCONNECTED:
    #             await websocket.close()
    #     except RuntimeError as close_error:
    #         print(f"Attempted closing websocket, but it seems to be closed already. {close_error}")
