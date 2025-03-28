import json
import os

import pytest
import yaml
from pyorc import sample_data
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
        return json.load(f)


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
    yield session
    # Close the session and drop all tables after tests run
    session.close()
    db.Base.metadata.drop_all(engine)
