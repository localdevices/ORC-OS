# tests/test_log.py
from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from orc_api.routers import log

app = FastAPI()
app.include_router(log.router)

client = TestClient(app)


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
