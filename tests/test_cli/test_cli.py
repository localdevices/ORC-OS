import json
import os
from pathlib import Path

from orc_api.cli import video as cli_video
from orc_api.cli.service import delete_service, export_service, import_service
from orc_api.schemas.service import ServiceExportData

service_data = {
    "service_short_name": "test-service",
    "service_long_name": "Test Service",
    "service_type": "ONE_TIME",
    "description": "A test service",
    "readme": "This is a test service.",
    "version": "1.0.0",
    "update_url": "http://example.com/update",
    "parameters": [
        {
            "parameter_short_name": "param1",
            "parameter_long_name": "Parameter 1",
            "parameter_type": "STRING",
            "default_value": "default",
            "nullable": False,
        }
    ],
}


def test_import_export_service_roundtrip(session_empty, tmpdir):
    # Test importing and exporting a service
    # Create a temporary service file
    tmp_service_file = Path(tmpdir / "service.json")
    tmp_service_file_out = Path(tmpdir / "exported_service.json")
    service_data_export = ServiceExportData.model_validate(service_data)
    with open(tmp_service_file, "w") as f:
        json.dump(service_data, f)
    try:
        # Import the service
        r = import_service(json_path=tmp_service_file, db=session_empty)

        # Export and verify
        r = export_service(service_id=1, db=session_empty, output_path=tmp_service_file_out)
        with open(tmp_service_file_out, "r") as f:
            exported = json.load(f)
        service_result_export = ServiceExportData.model_validate(exported)
        assert service_result_export == service_data_export
        # delete service and check
        delete_service(service_id=1, db=session_empty)
        # check if error is received when trying to export deleted service
        r = export_service(service_id=1, db=session_empty, output_path=tmp_service_file_out)
        assert r["status"] == "error"
        r = delete_service(service_id=1, db=session_empty)
        assert r["status"] == "error"
        r = export_service(service_id=1, db=session_empty, output_path=tmp_service_file_out)

    finally:
        os.unlink(tmp_service_file)
        os.unlink(tmp_service_file_out)


def test_import_list_delete_video(session_config, vid_file):
    # Test video CLI operations
    # Add video
    result = cli_video.add_video(db=session_config, file_path=vid_file, timestamp="20240101T120000Z")
    video_id = result["video_id"]
    assert result["status"] == "success"
    # List videos
    result_list = cli_video.list_videos(db=session_config)
    assert result_list is not None
    assert result_list["status"] == "success"
    assert any(v == video_id for v in result_list["videos"])

    # Delete video
    result_delete = cli_video.delete_video(db=session_config, video_id=video_id)
    assert result_delete["status"] == "success"

    # Verify deletion
    result_list_after = cli_video.list_videos(db=session_config)
    assert result_list_after is not None
    assert result_list_after["status"] == "success"
    assert result_list_after["videos"] is None
