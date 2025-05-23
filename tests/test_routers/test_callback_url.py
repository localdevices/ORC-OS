import os
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from requests.models import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import Base, CallbackUrl
from orc_api.main import app
from orc_api.schemas.callback_url import CallbackUrlResponse

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_override():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = get_db_override
client = TestClient(app)


@pytest.fixture
def mocked_db_response():
    return {
        "id": 1,
        "url": "https://example.com/callback",
        "token_refresh_end_point": "/api/token/refresh",
        "token_access": "token_access_value",
        "token_refresh": "token_refresh_value",
        "token_expiration": datetime(2024, 1, 1, 5, 0, 0),
        "created_at": datetime(2024, 1, 1, 0, 0, 0),
    }


def test_get_callback_url_empty():
    response = client.get("/callback_url/")
    assert response.status_code == 200
    assert response.json() is None


def test_get_callback_url_success(mocked_db_response):
    # create one record
    callback_url_response = CallbackUrlResponse(**mocked_db_response)
    callback_url_dict = callback_url_response.model_dump(exclude_none=True, exclude={"id", "created_at"})
    callback_url_dict["url"] = str(callback_url_dict["url"])
    # Base.metadata.create_all(bind=engine)
    db = next(get_db_override())
    crud.callback_url.add(db, CallbackUrl(**callback_url_dict))
    # check if the data can be retrieved
    app.dependency_overrides[get_db] = get_db_override
    client = TestClient(app)

    response = client.get("/callback_url/")
    assert response.status_code == 200
    print()
    assert response.json()["token_access"] == mocked_db_response["token_access"]


def test_update_callback_url_success(mocker):
    mock_get_tokens = mocker.patch("orc_api.schemas.callback_url.CallbackUrlCreate.get_tokens")
    mock_get_tokens.return_value.status_code = 200
    mock_get_tokens.return_value.json.return_value = {"access": "token_access_value", "refresh": "token_refresh_value"}
    mock_get_token_expiration = mocker.patch("orc_api.schemas.callback_url.CallbackUrlCreate.get_token_expiration")
    mock_get_token_expiration.return_value = datetime(2024, 1, 1, 0, 0, 0)
    # mock_add_callback = mocker.patch("orc_api.crud.callback_url.add")

    request_body = {
        "url": "https://example.com/callback",
        "user": "some_user@some_host.com",
        "password": "secure_password",
    }
    response = client.post("/callback_url/", json=request_body)

    assert response.status_code == 201
    # mock_add_callback.assert_called_once()


def test_update_callback_url_localhost_success(mocker):
    mock_get_tokens = mocker.patch("orc_api.schemas.callback_url.CallbackUrlCreate.get_tokens")
    mock_get_tokens.return_value.status_code = 200
    mock_get_tokens.return_value.json.return_value = {"access": "token_access_value", "refresh": "token_refresh_value"}
    mock_get_token_expiration = mocker.patch("orc_api.schemas.callback_url.CallbackUrlCreate.get_token_expiration")
    mock_get_token_expiration.return_value = datetime(2024, 1, 1, 0, 0, 0)
    # mock_add_callback = mocker.patch("orc_api.crud.callback_url.add")

    request_body = {
        "url": "http://localhost:8000/callback",
        "user": "some_user@some_host.com",
        "password": "secure_password",
    }
    response = client.post("/callback_url/", json=request_body)

    assert response.status_code == 201


def test_update_callback_url_invalid_tokens(mocker):
    mock_get_tokens = mocker.patch("orc_api.schemas.callback_url.CallbackUrlCreate.get_tokens")
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


@pytest.mark.skipif(
    not os.getenv("LIVEORC_URL") or not os.getenv("LIVEORC_EMAIL") or not os.getenv("LIVEORC_PASSWORD"),
    reason="This test requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set",
)
def test_update_callback_url_real_input():
    # this requires LIVEORC_URL, LIVEORC_EMAIL and LIVEORC_PASSWORD to be set

    request_body = {
        "url": os.getenv("LIVEORC_URL"),
        "user": os.getenv("LIVEORC_EMAIL"),
        "password": os.getenv("LIVEORC_PASSWORD"),
    }
    response = client.post("/callback_url/", json=request_body)
    print(response.json())
    assert response.status_code == 201


def test_get_set_refresh_tokens_success(mocker):
    mock_get_tokens = mocker.patch("orc_api.schemas.callback_url.CallbackUrlCreate.get_tokens")
    mock_get_tokens.return_value.status_code = 200
    mock_get_tokens.return_value.json.return_value = {"access": "token_access_value", "refresh": "token_refresh_value"}
    mock_get_token_expiration = mocker.patch("orc_api.schemas.callback_url.CallbackUrlCreate.get_token_expiration")
    mock_get_token_expiration.return_value = datetime(2024, 1, 1, 0, 0, 0)
    # mock_add_callback = mocker.patch("orc_api.crud.callback_url.add")

    request_body = {
        "url": "https://example.com/callback",
        "user": "some_user@some_host.com",
        "password": "secure_password",
    }
    _ = client.post("/callback_url/", json=request_body)

    # create a mocked response, which should then be stored in the database
    mock_response = mocker.MagicMock(spec=Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {"access": "new_access_token", "refresh": "new_refresh_token"}
    _ = mocker.patch("requests.post", return_value=mock_response)
    # once token is stored refresh it!
    response = client.get("/callback_url/refresh_tokens/")
    assert response.status_code == 200
    assert response.json()["token_access"] == "new_access_token"
