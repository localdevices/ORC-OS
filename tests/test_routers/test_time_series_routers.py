from datetime import datetime, timedelta

from orc_api import db as models

# get the database connection from general configuration instances

# engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
#
#
# def get_db_override():
#     Base.metadata.create_all(bind=engine)
#     session = SessionLocal()
#     try:
#         yield session
#     finally:
#         # Base.metadata.drop_all(bind=engine)
#         session.close()
#

# @pytest.fixture
# def auth_client():
#     app.dependency_overrides[get_db] = get_db_override
#     app.state.session = next(get_db_override())
#     # app.state.executor = queue.PriorityThreadPoolExecutor(max_workers=1)  # ThreadPoolExecutor(max_workers=1)
#     client = TestClient(app)
#     # credentials = HTTPBasicCredentials(password="welcome123")
#     credentials = {"password": "welcome123"}
#     # first create the password
#     _ = client.post("/api/auth/set_password/", params=credentials)
#     response = client.post("/api/auth/login/", params=credentials)
#     assert response.status_code == 200
#     return TestClient(app, cookies=response.cookies)
#


def test_get_patch_post_time_series(auth_client, db_session):
    # add some time series
    # db_session = next(get_db_override())
    ts1 = models.TimeSeries(timestamp=datetime.now(), h=20.0)
    ts2 = models.TimeSeries(timestamp=datetime.now() + timedelta(hours=1), h=21.0)

    db_session.add_all([ts1, ts2])
    db_session.commit()
    r = auth_client.get("/api/time_series/1/")
    assert r.status_code == 200
    r = auth_client.get("/api/time_series/2/")
    assert r.status_code == 200
    r = auth_client.get("/api/time_series/3/")
    assert r.status_code == 404
    # try patching time series
    r = auth_client.patch("/api/time_series/1/", json={"h": 22.0})
    assert r.status_code == 200
    assert r.json()["h"] == 22.0
    # also check in database if h was changed
    rec = db_session.get(models.TimeSeries, 1)
    assert rec.h == 22.0
    # add via post
    r = auth_client.post(
        "/api/time_series/", json={"timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"), "h": 23.0}
    )
    assert r.status_code == 201
    assert r.json()["h"] == 23.0
    assert r.json()["id"] == 3
    # get all time series again
    r = auth_client.get("/api/time_series/")
    assert r.status_code == 200
    assert len(r.json()) == 3

    # get all time series with no video_config_ids (should return empty)
    r = auth_client.get("/api/time_series/", params={"video_config_ids": [1]})
    assert len(r.json()) == 0
    # get all time series with null video_config_ids (should return empty)
    r = auth_client.get("/api/time_series/", params={"video_config_ids": [0]})
    assert len(r.json()) == 3
    # remove after test
    db_session.query(models.TimeSeries).delete()
    db_session.commit()
    db_session.flush()
