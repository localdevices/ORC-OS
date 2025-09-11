from datetime import datetime, timezone

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api import ALGORITHM, SECRET_KEY
from orc_api.database import get_db
from orc_api.db import Base
from orc_api.main import app
from orc_api.routers.auth import create_token

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_override():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        # Base.metadata.drop_all(bind=engine)
        session.close()


# # Setup an in-memory database
# SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
# engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
# TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()
#
# Create the app
# app = FastAPI()
#
# # Dependency override to use the in-memory database
# def override_get_db():
#     db = TestingSessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()


# app.include_router(auth.router)


@pytest.fixture
def client():
    """Fixture to provide a test client."""
    # Add the dependency override and routes
    app.dependency_overrides[get_db] = get_db_override
    app.state.session = next(get_db_override())

    return TestClient(app)


def test_check_and_setup_password(client):
    """Inserts a test password into the in-memory database before testing."""
    # first check if there is no password yet
    r = client.get("/auth/password_available")
    assert r.status_code == 200
    assert r.json() is False
    # now set a password.
    r = client.post("/auth/set_password", params={"password": "welcome123"})
    assert r.status_code == 200
    assert r.json()["message"] == "Password set successfully."
    # now the password_available should return true
    r = client.get("/auth/password_available")
    assert r.status_code == 200
    assert r.json() is True
    # you should now not be allowed to change the password without being logged in
    client.post("/auth/logout")
    r = client.post("/auth/set_password", params={"password": "cannot_change_password"})
    assert r.status_code == 401
    # let's login with a wrong password
    r = client.post("/auth/login", params={"password": "wrong_password"})
    assert r.status_code == 401
    # Now login with the right password and try to change the password
    r = client.post("/auth/login", params={"password": "welcome123"})
    assert r.status_code == 200
    r = client.post("/auth/set_password", params={"password": "new_password"})
    # now logout and check if indeed you are no longer able to change password
    r = client.post("/auth/logout")
    assert r.status_code == 200
    # now log back in with the new password
    r = client.post("/auth/login", params={"password": "new_password"})
    assert r.status_code == 200
    # and logout agian
    r = client.post("/auth/logout")
    assert r.status_code == 200

    #
    # with TestingSessionLocal() as db:
    #     password = Password(id=1, hashed_password="hashed_password_example")  # Example test data
    #     db.add(password)
    #     db.commit()


def test_create_token_structure():
    """Test if the token contains the expected payload structure."""
    token = create_token()
    decoded_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert "exp" in decoded_token
    assert "sub" in decoded_token
    assert decoded_token["sub"] == "user"


def test_create_token_expiration():
    """Test if the token expiration is set to the correct duration (15 minutes)."""
    token = create_token()
    decoded_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    expiration_time = decoded_token["exp"]
    creation_time = datetime.now(tz=timezone.utc).timestamp()
    assert expiration_time > creation_time
    assert expiration_time <= (creation_time + 15 * 60)


def test_create_token_is_string():
    """Test if the generated token is a string."""
    token = create_token()
    assert isinstance(token, str)


def test_password_available_with_password(client, setup_password):
    """Test endpoint when a password exists in the database."""
    response = client.get("/password_available")
    assert response.status_code == 200
    assert response.json() is True


def test_password_available_without_password(client):
    """Test endpoint when no password exists in the database."""
    response = client.get("/password_available")
    assert response.status_code == 200
    assert response.json() is False
