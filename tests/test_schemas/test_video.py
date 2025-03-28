from datetime import UTC, datetime

import pytest
from pyorc import sample_data
from your_module import VideoResponse  # Replace 'your_module' with the name of the module where your class is located.

from orc_api import db as models
from orc_api.schemas.time_series import TimeSeriesBase


@pytest.fixture
def video_schema():
    return VideoResponse(
        id=1,
        file=sample_data.get_hommerich_dataset(),
        status=models.VideoStatus.NEW,
        sync_status=True,
        remote_id=1001,
        site_id=2002,
        timestamp=datetime.now(UTC),
        video_config=101,
    )


time_series = (TimeSeriesBase(),)
