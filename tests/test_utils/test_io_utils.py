from datetime import datetime

from orc_api.utils import disk_management


def test_get_file_timestamp_datetimestr():
    fn_fmt = "video_{%Y%m%d_%H%M%S}.mp4"
    fn = "video_20230101_010203.mp4"
    timestamp = disk_management.get_timestamp(fn, parse_from_fn=True, fn_fmt=fn_fmt)
    assert isinstance(timestamp, datetime)
    assert timestamp.strftime("%Y%m%d_%H%M%S") == "20230101_010203"


def test_get_file_timestamp_unix():
    dt = datetime(2023, 1, 1, 1, 2, 3)
    # convert to unix time stamp
    dt_unix = dt.timestamp()
    fn_fmt = "video_{unix}.mp4"
    fn = f"video_{dt_unix}.mp4"
    timestamp = disk_management.get_timestamp(fn, parse_from_fn=True, fn_fmt=fn_fmt)
    assert isinstance(timestamp, datetime)
    assert timestamp.strftime("%Y%m%d_%H%M%S") == "20230101_010203"
