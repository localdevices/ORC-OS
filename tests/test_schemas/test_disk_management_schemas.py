import os

import pytest

from orc_api.schemas.disk_management import DiskManagementBase


@pytest.fixture
def dm(tmp_path):
    # touch some crap files
    os.makedirs(tmp_path / "failed")
    with open(tmp_path / "failed/a.txt", "w") as f:
        f.write("a")

    # create some disk management settings with a ridiculous space requirement
    return DiskManagementBase(
        home_folder=str(tmp_path),
        min_free_space=1e6,  # 1000 TB
        critical_space=5e5,
        frequency=3600,
    )


def test_dm_remove_files(dm):
    dm.cleanup()
    assert not os.path.exists(os.path.join(dm.home_folder, "failed", "a.txt"))


def test_dm_not_remove_files(dm):
    dm.min_free_space = 0.1  # 0.1 GB is sufficient. File should not be deleted
    dm.cleanup()
    assert os.path.exists(os.path.join(dm.home_folder, "failed", "a.txt"))
