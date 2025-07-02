import os

import pytest

from orc_api.schemas.disk_management import DiskManagementBase


@pytest.fixture
def orc_home_folder(tmp_path):
    return tmp_path


@pytest.fixture
def dm(orc_home_folder):
    # touch some crap file
    orc_sub_folder = orc_home_folder / "20010101" / "1"
    os.makedirs(orc_sub_folder)
    with open(orc_sub_folder / "a.txt", "w") as f:
        f.write("a")

    # create some disk management settings with a ridiculous space requirement
    return DiskManagementBase(
        min_free_space=1e6,  # 1000 TB
        critical_space=5e5,
        frequency=3600,
    )


def test_dm_remove_files(dm, orc_home_folder):
    dm.cleanup(orc_home_folder)
    assert not os.path.exists(os.path.join(orc_home_folder, "20010101", "1", "a.txt"))


def test_dm_not_remove_files(dm, orc_home_folder):
    dm.min_free_space = 0.1  # 0.1 GB is sufficient. File should not be deleted
    dm.cleanup(orc_home_folder)
    assert os.path.exists(os.path.join(orc_home_folder, "20010101", "1", "a.txt"))
