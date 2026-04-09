import os
from datetime import datetime
from pathlib import Path

import pytest

from orc_api.utils import disk_management, io

GEOJSON_WITH_CRS = """
{
    "type": "FeatureCollection",
    "crs": {
        "type": "name",
        "properties": {
            "name": "EPSG:32636"
        }
    },
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [0, 0, 0]
            },
            "properties": {}
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [1, 1, 1]
            },
            "properties": {}
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [2, 4, 2]
            },
            "properties": {}
        }
    ]
}
"""

GEOJSON_WITHOUT_CRS = """
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [0, 0, 0]
            },
            "properties": {}
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [1, 1, 1]
            },
            "properties": {}
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [2, 4, 2]
            },
            "properties": {}
        }
    ]
}
"""


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


def test_read_cross_section_csv(tmpdir):
    # Create a temporary CSV file for testing
    test_csv_path = Path(tmpdir) / "test_cross_section.csv"
    with open(test_csv_path, "w") as f:
        f.write("X,Y,Z\n")
        f.write("0,0,0\n")
        f.write("1,1,1\n")
        f.write("2,4,2\n")

    # Test the function
    cs = io.read_cross_section_from_csv(test_csv_path)
    assert "features" in cs
    # Clean up the temporary file
    os.remove(test_csv_path)


@pytest.mark.parametrize(
    "json_string",
    [
        GEOJSON_WITH_CRS,
        GEOJSON_WITHOUT_CRS,
    ],
)
def test_read_cross_section_geojson(tmpdir, json_string):
    # Create a temporary CSV file for testing
    test_json_path = Path(tmpdir) / "test_cross_section.geojson"
    with open(test_json_path, "w") as f:
        f.write(json_string)
    # Test the function
    cs = io.read_cross_section_from_geojson(test_json_path)
    assert "features" in cs
    # Clean up the temporary file
    os.remove(test_json_path)
