# tests/test_log.py
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.testclient import TestClient

from orc_api.routers import log
from orc_api.routers.log import stream_log

app = FastAPI()
app.include_router(log.router)

client = TestClient(app)


@pytest.fixture
def mock_websocket():
    websocket = MagicMock(spec=WebSocket)
    websocket.accept = AsyncMock()
    websocket.send_text = AsyncMock()
    websocket.close = AsyncMock()
    return websocket


@pytest.fixture
def mock_conn_manager():
    with patch("orc_api.routers.log.conn_manager") as mock:
        mock.connect = AsyncMock()
        mock.disconnect = MagicMock()
        yield mock


@pytest.fixture
def mock_logger():
    with patch("orc_api.routers.log.logger") as mock:
        yield mock


@pytest.fixture
def mock_stream_new_lines():
    with patch("orc_api.routers.log.stream_new_lines") as mock:
        mock.return_value = AsyncMock()
        yield mock


def test_get_log_success(mocker):
    """Test get_log with a valid log file."""
    mock_file_path = "/valid/mock/log/file.log"
    mock_lines = "Line1\nLine2\nLine3\n"
    mocker.patch("orc_api.routers.log.logger.handlers", [MagicMock(), MagicMock(baseFilename=mock_file_path)])
    mocker.patch("orc_api.routers.log.get_last_lines", return_value=mock_lines)

    response = client.get("/log/")
    assert response.status_code == 200
    assert response.json() == mock_lines


def test_get_log_file_not_found(mocker):
    """Test get_log when the log file does not exist."""
    mock_file_path = "/invalid/mock/log/file.log"
    mocker.patch("orc_api.routers.log.logger.handlers", [MagicMock(), MagicMock(baseFilename=mock_file_path)])
    # mocker.patch("orc_api.routers.log.get_last_lines", side_effect=FileNotFoundError("Log file not found"))

    response = client.get("/log/")
    assert response.status_code == 404
    assert "Log file not found" in response.text


def test_get_log_custom_count(mocker):
    """Test get_log with a custom count parameter."""
    mock_file_path = "/mock/log/file.log"
    mock_lines = "LastLine1\nLastLine2\n"
    mock_count = 2
    mocker.patch("orc_api.routers.log.logger.handlers", [MagicMock(), MagicMock(baseFilename=mock_file_path)])
    mocker.patch("orc_api.routers.log.get_last_lines", return_value=mock_lines)

    response = client.get(f"/log?count={mock_count}")
    assert response.status_code == 200
    assert response.json() == mock_lines


# tests for the websocket
@pytest.mark.asyncio
async def test_stream_log_success(mock_websocket, mock_conn_manager, mock_logger, mock_stream_new_lines):
    """Test successful connection and streaming."""
    handler_mock = MagicMock()
    handler_mock.baseFilename = "test.log"
    mock_logger.handlers = [MagicMock(), handler_mock]

    await stream_log(mock_websocket)

    mock_conn_manager.connect.assert_called_once_with(mock_websocket)
    mock_stream_new_lines.assert_awaited_once_with(mock_websocket, "test.log")


@pytest.mark.asyncio
async def test_stream_log_no_log_file(mock_websocket, mock_conn_manager, mock_logger):
    """Test when no log file is found."""
    handler_mock = MagicMock()
    handler_mock.baseFilename = None
    mock_logger.handlers = [MagicMock(), handler_mock]

    await stream_log(mock_websocket)

    mock_conn_manager.connect.assert_called_once_with(mock_websocket)
    mock_websocket.close.assert_awaited_once_with(code=1003, reason="Log file not found!")


@pytest.mark.asyncio
async def test_stream_log_websocket_disconnect(mock_websocket, mock_conn_manager, mock_logger, mock_stream_new_lines):
    """Test websocket disconnection handling."""
    handler_mock = MagicMock()
    handler_mock.baseFilename = "test.log"
    mock_logger.handlers = [MagicMock(), handler_mock]
    mock_stream_new_lines.side_effect = WebSocketDisconnect()

    await stream_log(mock_websocket)

    mock_conn_manager.connect.assert_called_once_with(mock_websocket)
    mock_conn_manager.disconnect.assert_called_once_with(mock_websocket)
