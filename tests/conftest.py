import json
import os
from datetime import datetime, timedelta

import pytest
import yaml
from pyorc import CameraConfig, sample_data
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.pool import StaticPool

from orc_api import db


@pytest.fixture
def vid_file():
    return sample_data.get_hommerich_dataset()  # os.path.join(EXAMPLE_DATA_DIR, "hommerich", "20240718_162737.mp4")


@pytest.fixture
def recipe_file():
    path = sample_data.get_hommerich_pyorc_files()
    return os.path.join(path, "hommerich.yml")


@pytest.fixture
def cam_config_file():
    path = sample_data.get_hommerich_pyorc_files()
    return os.path.join(path, "cam_config_gcp1.json")


@pytest.fixture
def cross_section_file():
    path = sample_data.get_hommerich_pyorc_files()
    return os.path.join(path, "cs1_ordered.geojson")


@pytest.fixture
def recipe(recipe_file):
    with open(recipe_file, "r") as f:
        body = f.read()
    recipe_body = yaml.load(body, Loader=yaml.FullLoader)
    # turn into string
    return json.dumps(recipe_body)


@pytest.fixture
def cam_config(cam_config_file):
    with open(cam_config_file, "r") as f:
        # ensure that a rvec and tvec are added before passing
        cam_config_dict = json.load(f)
    cam_config = CameraConfig(**cam_config_dict)
    rvec, tvec = cam_config.pnp
    cam_config.rvec = rvec
    cam_config.tvec = tvec
    return cam_config.to_dict_str()


@pytest.fixture
def cross_section(cross_section_file):
    with open(cross_section_file, "r") as f:
        return json.load(f)


@pytest.fixture
def session_empty(tmpdir):
    db_path = ":memory:"  # ?cache=shared"
    # Create an in-memory SQLite database for testing; adjust connection string for other databases
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    # Create all tables from metadata (assumes models use SQLAlchemy Base)
    db.Base.metadata.create_all(engine)
    Session = scoped_session(sessionmaker(bind=engine))
    session = Session()
    try:
        yield session
    finally:
        # Close the session and drop all tables after tests run
        session.close()
        db.Base.metadata.drop_all(engine)


# Example fixture
@pytest.fixture
def session_config(session_empty, tmpdir):
    session = session_empty
    # Create and add a Device instance
    device_instance = db.Device(
        # Add relevant fields for the Device model
        name="Test Device",
    )
    # Create and add a Settings instance
    # Add test data
    settings_instance = db.Settings(
        parse_dates_from_file=True,
        video_file_fmt="video_{%Y%m%dT%H%M%S}.mp4",
        allowed_dt=3600,
        shutdown_after_task=False,
        reboot_after=0,
        enable_daemon=False,
    )
    disk_management_instance = db.DiskManagement(home_folder=str(tmpdir))
    water_level_settings_instance = db.WaterLevelSettings()
    callback_url_instance = db.CallbackUrl(
        token_refresh_end_point="/api/token/refresh/",
        token_refresh="some_token",
        token_access="some_other_token",
        token_expiration=datetime.now() + timedelta(days=1),
    )
    session.add(device_instance)
    session.add(settings_instance)
    session.add(disk_management_instance)
    session.add(water_level_settings_instance)
    session.add(callback_url_instance)
    # commit to give all an id
    session.commit()
    return session  # Provide the session to tests
