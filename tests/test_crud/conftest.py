from datetime import datetime, timedelta

import pytest

# from nodeorc import models, log
from orc_api import crud, db


@pytest.fixture
def session_water_levels(session_config, monkeypatch):
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_config)
    # create a bunch of water level in the database around the current datetime
    timestamps = [datetime.now() + timedelta(hours=h) for h in range(-4, 5)]
    values = list(range(len(timestamps)))
    # make several timestamps to store
    for t, v in zip(timestamps, values):
        water_level_instance = db.TimeSeries(
            timestamp=t,
            h=v,
        )
        session_config.add(water_level_instance)
    session_config.commit()
    return session_config


@pytest.fixture
def session_video(session_config, vid_file, monkeypatch):
    # create a single video with present time stamp
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_config)
    # give a timestamp too far before the first available time stamp time series
    timestamp = datetime.now()
    video = db.Video(file=vid_file, timestamp=timestamp)
    _ = crud.video.create(session_config, video)
    return session_config


# @pytest.fixture
# def logger():
#     return log.start_logger(True, False)
#
#
# @pytest.fixture
# def callback(output_nc):
#     obj = models.Callback(
#         file=models.File(
#             tmp_name=os.path.split(output_nc)[1],
#             remote_name=os.path.split(output_nc)[1]
#         ),
#         func_name="discharge",
#         kwargs={},
#         storage=models.Storage(
#             url="",
#             bucket_name=os.path.split(output_nc)[0]
#         ),
#         endpoint="/api/timeseries/"  # used to extend the default callback url
#     )
#     return obj
