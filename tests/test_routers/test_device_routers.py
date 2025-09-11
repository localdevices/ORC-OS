from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api.database import get_db
from orc_api.db import Base
from orc_api.routers import device
from orc_api.schemas.device import DeviceFormStatus

# Database setup for testing
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(device.router)

client = TestClient(app)


def get_db_override():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = get_db_override
client = TestClient(app)


def test_update_device_create_new_and_get():
    device_data = {
        "name": "test_device",
        "operating_system": "Test OS",
        "processor": "Test Processor",
        "memory": 16.0,
        "free_storage": 100.0,
        "orc_os_version": "1.0.0",
    }
    response = client.post("/device/", json=device_data)
    assert response.status_code == 201
    response_data = response.json()
    assert response_data["name"] == device_data["name"]
    assert response_data["operating_system"] == device_data["operating_system"]
    assert response_data["memory"] == device_data["memory"]
    # now try to get the device
    response = client.get("/device/")
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["name"] == device_data["name"]
    assert response_data["operating_system"] == device_data["operating_system"]
    assert response_data["memory"] == device_data["memory"]


def test_update_device_update_existing():
    updated_device_data = {
        "name": "updated_device",
        "operating_system": "Updated OS",
        "processor": "Updated Processor",
    }
    response = client.post("/device/", json=updated_device_data)
    assert response.status_code == 201
    response_data = response.json()
    assert response_data["name"] == updated_device_data["name"]
    assert response_data["operating_system"] == updated_device_data["operating_system"]
    assert response_data["processor"] == updated_device_data["processor"]


def test_get_device_statuses_success():
    response = client.get("/device/statuses/")
    assert response.status_code == 200
    expected_statuses = [
        {"key": "HEALTHY", "value": 0},
        {"key": "LOW_VOLTAGE", "value": 1},
        {"key": "LOW_STORAGE", "value": 2},
        {"key": "CRITICAL_STORAGE", "value": 3},
    ]
    assert response.json() == expected_statuses


def test_get_device_form_statuses():
    response = client.get("/device/form_statuses/")
    assert response.status_code == 200
    expected = [
        {"key": "NOFORM", "value": DeviceFormStatus.NOFORM.value},
        {"key": "VALID_FORM", "value": DeviceFormStatus.VALID_FORM.value},
        {"key": "INVALID_FORM", "value": DeviceFormStatus.INVALID_FORM.value},
        {"key": "BROKEN_FORM", "value": DeviceFormStatus.BROKEN_FORM.value},
    ]
    assert response.json() == expected
