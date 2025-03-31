import numpy as np


def test_video_config_schema(video_config_response):
    vc = video_config_response
    assert vc.id == 1
    assert vc.name == "some video config"
    assert "video" in vc.recipe.data


def test_video_config_transform_cs(video_config_response):
    # manipulate rvec and tvec and try it out
    vc = video_config_response
    tvec = [0.5, 10.0, 1]
    vc.tvec = tvec
    vc.rvec = [0.0, 0.0, 0.5]  # rotation only around the z-axis
    cs_transform = vc.cross_section_rt
    # check off set, vertically should be 1
    assert np.allclose(cs_transform.gdf.geometry.z - vc.cross_section.gdf.geometry.z, 1)


def test_video_config_recipe_cleaned(video_config_response):
    vc = video_config_response
    tvec = [0.0, 0.0, 1]
    vc.tvec = tvec
    # vc.rvec = [0.0, 0.0, 0.5]  # rotation only around the z-axis
    new_z = vc.recipe_transect_filled.data["transect"]["transect_1"]["geojson"]["features"][0]["geometry"][
        "coordinates"
    ][-1]
    orig_z = vc.cross_section.features["features"][0]["geometry"]["coordinates"][-1]
    assert np.isclose(new_z - orig_z, 1)
