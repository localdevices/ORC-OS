from orc_api.utils import sys_utils


def test_get_server_timezone_info():
    tz_info = sys_utils.get_server_timezone_info()
    assert isinstance(tz_info, dict)
    assert "timezone" in tz_info
    assert "offset_seconds" in tz_info
    assert "offset_string" in tz_info
    assert isinstance(tz_info["offset_string"], str)
    assert isinstance(tz_info["timezone"], str)
    assert isinstance(tz_info["offset_seconds"], int)
