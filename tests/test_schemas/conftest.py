import json

import pytest

from orc_api.db import CameraConfig, CrossSection, Recipe, VideoConfig


@pytest.fixture
def session_cam_config(session_empty, cam_config):
    c = CameraConfig(name="some camera config", data=cam_config)
    session_empty.add(c)
    session_empty.commit()
    session_empty.refresh(c)
    return session_empty


@pytest.fixture
def session_cross_section(session_empty, cross_section):
    cs = CrossSection(name="some cross section", features=cross_section)
    session_empty.add(cs)
    session_empty.commit()
    session_empty.refresh(cs)
    return session_empty


@pytest.fixture
def session_recipe(session_empty, recipe):
    recipe = json.loads(recipe)
    r = Recipe(name="some recipe", data=recipe)
    session_empty.add(r)
    session_empty.commit()
    session_empty.refresh(r)
    return session_empty


@pytest.fixture
def session_video_config(session_empty, recipe, cam_config, cross_section):
    # requires a cross section, camera config and recipe
    recipe = json.loads(recipe)
    r = Recipe(name="some recipe", data=recipe)
    cs = CrossSection(name="some cross section", features=cross_section)
    c = CameraConfig(name="some camera config", data=cam_config)
    session_empty.add(r)
    session_empty.add(cs)
    session_empty.add(c)
    session_empty.commit()
    session_empty.refresh(r)
    session_empty.refresh(c)
    session_empty.refresh(cs)

    vc = VideoConfig(
        name="some video config",
        recipe_id=r.id,
        cross_section_id=cs.id,
        camera_config_id=c.id,
    )
    # now create the VideoConfig
    session_empty.add(vc)
    session_empty.commit()
    session_empty.refresh(vc)
    print(vc)
    return session_empty
