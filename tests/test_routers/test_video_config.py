from orc_api.schemas.video_config import VideoConfigBase, VideoConfigResponse

# engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def test_add_filled_video_config(auth_client, video_config_dict):
    response = auth_client.post("/api/video_config/", json=video_config_dict)
    video_config_stored = VideoConfigResponse.model_validate(response.json())
    video_config_base = VideoConfigBase.model_validate(response.json())
    assert response.status_code == 201
    # if everything went well, the attributes should be in the database and all have an id.
    assert video_config_stored.id == 1
    assert video_config_stored.recipe.id == 1
    # now try to change one field (name) of a underlying attribute and try the post again. id should NOT change
    # but name should!
    video_config_base.recipe.name = "new_name"
    video_config_base.cross_section.name = "new_name_cs"
    video_config_base.cross_section_wl.name = "new_name_cs_wl"
    video_config_base.camera_config.name = "new_name_cam_config"
    video_config_dict = video_config_base.model_dump(exclude_none=True, mode="json")
    response = auth_client.post("/api/video_config", json=video_config_dict)
    video_config_update = VideoConfigResponse.model_validate(response.json())
    assert video_config_update.id == 1
    assert video_config_update.recipe.id == 1
    assert video_config_update.recipe.name == "new_name"
    assert video_config_update.camera_config.id == 1
    assert video_config_update.camera_config.name == "new_name_cam_config"
    assert video_config_update.cross_section.id == 1
    assert video_config_update.cross_section.name == "new_name_cs"
    assert video_config_update.cross_section_wl.id == 2  # cross section is stored twice
    assert video_config_update.cross_section_wl.name == "new_name_cs_wl"


def test_add_empty_video_config(auth_client):
    video_config = VideoConfigBase(name="hello")
    video_config_dict = video_config.model_dump(exclude_none=True)
    _ = auth_client.get("/api/callback_url/")
    response = auth_client.post("/api/video_config/", json=video_config_dict)
    assert response.status_code == 201
