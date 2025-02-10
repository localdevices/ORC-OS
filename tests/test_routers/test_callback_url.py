import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from nodeorc_api.main import app
from nodeorc_api.schemas.callback_url import CallbackUrlCreate

client = TestClient(app)


def test_update_callback_url_success(mocker):
    mock_get_tokens = mocker.patch("nodeorc_api.schemas.callback_url.CallbackUrlCreate.get_tokens")
    mock_get_tokens.return_value.status_code = 200
    mock_get_tokens.return_value.json.return_value = {
        "access": "token_access_value",
        "refresh": "token_refresh_value"
    }
    mock_get_token_expiration = mocker.patch("nodeorc_api.schemas.callback_url.CallbackUrlCreate.get_token_expiration")
    mock_get_token_expiration.return_value = datetime(2024, 1, 1, 0, 0, 0)
    # mock_add_callback = mocker.patch("nodeorc_api.crud.callback_url.add")

    request_body = {
        "url": "https://example.com/callback",
        "user": "some_user@some_host.com",
        "password": "secure_password",
    }
    response = client.post("/callback_url/", json=request_body)

    assert response.status_code == 201
    # mock_add_callback.assert_called_once()


def test_update_callback_url_localhost_success(mocker):
    mock_get_tokens = mocker.patch("nodeorc_api.schemas.callback_url.CallbackUrlCreate.get_tokens")
    mock_get_tokens.return_value.status_code = 200
    mock_get_tokens.return_value.json.return_value = {
        "access": "token_access_value",
        "refresh": "token_refresh_value"
    }
    mock_get_token_expiration = mocker.patch("nodeorc_api.schemas.callback_url.CallbackUrlCreate.get_token_expiration")
    mock_get_token_expiration.return_value = datetime(2024, 1, 1, 0, 0, 0)
    # mock_add_callback = mocker.patch("nodeorc_api.crud.callback_url.add")

    request_body = {
        "url": "http://localhost:8000/callback",
        "user": "some_user@some_host.com",
        "password": "secure_password",
    }
    response = client.post("/callback_url/", json=request_body)

    assert response.status_code == 201
    # mock_add_callback.assert_called_once()


def test_update_callback_url_invalid_tokens(mocker):
    mock_get_tokens = mocker.patch("nodeorc_api.schemas.callback_url.CallbackUrlCreate.get_tokens")
    mock_get_tokens.return_value.status_code = 403
    mock_get_tokens.return_value.text = "Invalid tokens"

    request_body = {
        "url": "https://example.com/callback",
        "user": "some_user@some_host.com",
        "password": "secure_password",
    }
    response = client.post("/callback_url/", json=request_body)

    assert response.status_code == 403
    assert response.text == "Error: Invalid tokens"


def test_update_callback_url_missing_fields():
    # make a request without email
    request_body = {
        "password": "secure_password",
    }
    response = client.post("/callback_url/", json=request_body)

    assert response.status_code == 422


def test_update_callback_url_invalid_url_format():
    request_body = {
        "url": "not-a-valid-url",
        "user": "some_user@some_host.com",
        "password": "secure_password",
    }
    response = client.post("/callback_url/", json=request_body)

    assert response.status_code == 422
