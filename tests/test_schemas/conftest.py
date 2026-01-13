import json
import os
from datetime import datetime, timezone

import pytest
from pyorc import sample_data
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.db import CameraConfig, CrossSection, Recipe, TimeSeries, Video, VideoConfig
from orc_api.schemas.video import VideoResponse
from orc_api.schemas.video_config import VideoConfigResponse


@pytest.fixture
def session_cam_config(session_config, cam_config):
    c = CameraConfig(name="some camera config", data=cam_config)
    session_config.add(c)
    session_config.commit()
    session_config.refresh(c)
    return session_config


@pytest.fixture
def session_cross_section(session_config, cross_section):
    cs = CrossSection(name="some cross section", features=cross_section)
    session_config.add(cs)
    session_config.commit()
    session_config.refresh(cs)
    return session_config


@pytest.fixture
def session_recipe(session_config, recipe):
    recipe = json.loads(recipe)
    r = Recipe(name="some recipe", data=recipe)
    session_config.add(r)
    session_config.commit()
    session_config.refresh(r)
    return session_config


@pytest.fixture
def session_video_config(session_config, recipe, cam_config, cross_section):
    # requires a cross-section, camera config and recipe
    recipe = json.loads(recipe)
    # shorten the problem to only a few frames for speed of testing
    recipe["video"]["end_frame"] = 6
    r = Recipe(name="some recipe", data=recipe)
    cs = CrossSection(name="some cross section", features=cross_section)
    c = CameraConfig(name="some camera config", data=cam_config)
    session_config.add(r)
    session_config.add(cs)
    session_config.add(c)
    session_config.commit()
    session_config.refresh(r)
    session_config.refresh(c)
    session_config.refresh(cs)

    vc = VideoConfig(
        name="some video config",
        recipe_id=r.id,
        cross_section_id=cs.id,
        cross_section_wl_id=cs.id,
        camera_config_id=c.id,
    )
    # now create the VideoConfig
    session_config.add(vc)
    session_config.commit()
    session_config.refresh(vc)
    print(vc)
    return session_config


@pytest.fixture
def session_video_no_ts_with_config(session_video_config, monkeypatch):
    """Create session with a video, not yet run."""
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_video_config)
    vc_rec = session_video_config.query(VideoConfig).first()
    video = Video(
        timestamp=datetime.now(timezone.utc),
        video_config_id=vc_rec.id,
        file=os.path.split(sample_data.get_hommerich_dataset())[1],
    )
    video = crud.video.add(session_video_config, video)
    return session_video_config


@pytest.fixture
def session_video_with_config(session_video_config, monkeypatch):
    """Create session with a video, not yet run."""
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_video_config)
    vc_rec = session_video_config.query(VideoConfig).first()
    h = 93.345
    ts = TimeSeries(timestamp=datetime.now(timezone.utc), h=h)
    ts = crud.time_series.add(session_video_config, ts)
    video = Video(
        timestamp=datetime.now(timezone.utc),
        video_config_id=vc_rec.id,
        file=os.path.split(sample_data.get_hommerich_dataset())[1],
    )
    video = crud.video.add(session_video_config, video)
    print(video)
    return session_video_config


@pytest.fixture
def video_config_response(session_video_config: Session):
    vc_rec = session_video_config.query(VideoConfig).first()
    return VideoConfigResponse.model_validate(vc_rec)


@pytest.fixture
def video_response(session_video_with_config: Session):
    # retrieve recipe
    video_rec = session_video_with_config.query(Video).first()
    return VideoResponse.model_validate(video_rec)


@pytest.fixture
def video_response_no_ts(session_video_no_ts_with_config):
    """Return a video without a timeseries attached.

    Meant to test running with optical water level.
    """
    video_rec = session_video_no_ts_with_config.query(Video).first()
    return VideoResponse.model_validate(video_rec)
