# tests/test_alembic_migrations.py

import os
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine

import orc_api
from alembic import command
from alembic.config import Config


@pytest.fixture
def sqlite_file_db(tmp_path):
    """Fixture to provide a file-based SQLite database."""
    db_path = tmp_path / "test_alembic.sqlite"
    if db_path.exists():
        db_path.unlink()  # Clean up any leftover database file
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    yield engine, db_path
    engine.dispose()
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def mock_sqlite_engine(sqlite_file_db):
    """Mock `orc_api.db.sqlite_engine` to use our test database."""
    _, db_path = sqlite_file_db
    with patch("orc_api.db.sqlite_engine", f"sqlite:///{db_path}"):
        yield db_path


def test_alembic_migrations(sqlite_file_db, mock_sqlite_engine):
    """Test that Alembic migrations can run up to the latest version (head) on an in-memory SQLite database."""
    engine, db_path = sqlite_file_db

    # Ensure the database path is correctly passed to Alembic
    assert not os.path.exists(db_path), "Database file should not exist before migrations."

    # Path to your Alembic configuration file (relative to the root of your project)
    orc_path = os.path.split(orc_api.__file__)[0]
    alembic_ini_path = os.path.join(orc_path, "alembic.ini")
    # Path to your Alembic migration folder
    alembic_script_location = os.path.join(orc_path, "alembic")

    os.chdir(alembic_script_location)

    # Create an Alembic config object and set paths
    alembic_cfg = Config(alembic_ini_path)
    alembic_cfg.set_main_option("script_location", alembic_script_location)
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")

    # Start the migration to the `head`
    try:
        command.upgrade(alembic_cfg, "head")
    except Exception as e:
        pytest.fail(f"Failed to apply migrations: {e}")

    # Assert that migrations ran without any exception
    assert True, "Alembic migrations applied successfully."
