from pyorc import sample_data

from orc_api import db as models


def test_video_run(
    video_response,
    session_video_config,
    monkeypatch,
):
    monkeypatch.setattr("orc_api.schemas.video.get_session", lambda: session_video_config)
    assert video_response.status == models.VideoStatus.NEW
    video_response.run(base_path=sample_data.get_hommerich_pyorc_files())
    assert video_response.status == models.VideoStatus.DONE
    assert len(video_response.get_netcdf_files(base_path=sample_data.get_hommerich_pyorc_files())) > 0
    assert video_response.get_discharge_file(base_path=sample_data.get_hommerich_pyorc_files()) is not None
    # check if the time series has been updated
    ts = session_video_config.query(models.TimeSeries).filter(models.TimeSeries.id == 1).first()
    # q_50 should be available
    assert ts.q_50 is not None
    # check if video got updated also
    video = session_video_config.query(models.Video).filter(models.Video.id == 1).first()
    assert video.image is not None
