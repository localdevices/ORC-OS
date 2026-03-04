import subprocess
from unittest.mock import MagicMock, patch

from orc_api import crud, schemas
from orc_api.db.service import ServiceType


def test_get_patch_post_delete_service(auth_client, db_session, tmpdir, mocker, monkeypatch):
    original_run = subprocess.run

    def subprocess_side_effect(cmd, **kwargs):
        """Conditionally mock subprocess.run based on command."""
        # Only mock daemon-reload, let others run
        if cmd[1] == "systemctl":
            return MagicMock(returncode=0)
        # Let sudo commands actually run, but without the sudo since we are in a temp directory
        if cmd[0] == "sudo":
            return original_run(cmd[1:], **kwargs)
        return original_run(cmd, **kwargs)

    # replace service directory by a temporary directory for testing
    monkeypatch.setattr("orc_api.schemas.service.SERVICE_DIRECTORY", str(tmpdir))
    monkeypatch.setattr("orc_api.schemas.service.get_session", lambda: db_session)

    service = schemas.service.ServiceCreate(
        service_short_name="some-service",
        service_long_name="Some Service",
        service_type=ServiceType.ONE_TIME,
        description="This is a test service.",
    )
    service = crud.service.create_service(db=db_session, service=service)
    # add a parameter to the service
    param = schemas.service.ServiceParameterCreate(
        parameter_short_name="param1",
        parameter_long_name="Parameter 1",
        parameter_type=schemas.service.ParameterType.STRING,
        default_value="default",
        nullable=False,
        description="This is a test parameter.",
    )
    param = crud.service.add_service_parameter(db=db_session, service_id=service.id, param=param)
    db_session.refresh(param)
    db_session.refresh(service)
    db_session.flush()
    # first get the session through the router and check if service and parameter are included
    r = auth_client.get(f"/api/service/{service.id}/")
    assert r.status_code == 200
    assert r.json()["service_short_name"] == "some-service"
    # post a second service through the router
    service2 = schemas.service.ServiceCreate(
        service_short_name="some-service-2",
        service_long_name="Some Service 2",
        service_type=ServiceType.ONE_TIME,
        description="This is another test service.",
    )
    r = auth_client.post("/api/service/", json=service2.model_dump(mode="json"))
    assert r.status_code == 403
    # now patch to DEV_MODE and try again, expected is 201 and service is created successfully
    mocker.patch("orc_api.routers.service.DEV_MODE", True)
    r = auth_client.post("/api/service/", json=service2.model_dump(mode="json"))
    assert r.status_code == 201
    # check if amount of services is 2
    r = auth_client.get("/api/service/")
    assert r.status_code == 200
    assert len(r.json()) == 2
    # patch the first service through the router
    service_update = schemas.service.ServiceUpdate(
        service_long_name="Some Service Updated",
    )
    r = auth_client.patch(f"/api/service/{service.id}/", json=service_update.model_dump(mode="json"))
    assert r.status_code == 200
    assert r.json()["service_long_name"] == "Some Service Updated"
    # add a parameter to service 2 through the router
    param2 = schemas.service.ServiceParameterCreate(
        parameter_short_name="param2",
        parameter_long_name="Parameter 2",
        parameter_type=schemas.service.ParameterType.INTEGER,
        default_value="0",
        nullable=False,
    )
    r = auth_client.post("/api/service/1/parameters/", json=param2.model_dump(mode="json"))
    assert r.status_code == 200
    # check if parameter was added to service 2
    r = auth_client.get(f"/api/service/{service.id}/")
    assert len(r.json()["parameters"]) == 2
    # patch parameter
    param_update = schemas.service.ServiceParameterUpdate(
        parameter_short_name="param2_updated",
        parameter_long_name="Parameter 2 Updated",
        parameter_type=schemas.service.ParameterType.INTEGER,
        default_value="1",
    )
    r = auth_client.patch("/api/service/parameters/2/", json=param_update.model_dump(mode="json"))
    assert r.status_code == 200
    # check if parameter was updated
    r = auth_client.get(f"/api/service/{service.id}/")
    assert r.json()["parameters"][1]["parameter_short_name"] == "param2_updated".upper()
    assert r.json()["parameters"][1]["parameter_long_name"] == "Parameter 2 Updated"
    assert r.json()["parameters"][1]["default_value"] == "1"
    # try to write a .env file with some parameter values through the router
    parameter_values = {
        1: "value1",
        2: "2",
    }

    r = auth_client.post("/api/service/1/update_env/", json=parameter_values)
    assert r.status_code == 200
    env_file_path = r.json()["env_file_path"]
    # check if content of file contains parameters in expected format
    with open(env_file_path, "r") as f:
        content = f.read()
        assert 'PARAM1="value1"' in content
        assert "PARAM2_UPDATED=2" in content

    # delete parameter
    r = auth_client.delete("/api/service/parameters/2/")
    assert r.status_code == 204
    # check if parameter was deleted
    r = auth_client.get(f"/api/service/{service.id}/")
    assert len(r.json()["parameters"]) == 1
    # delete the second service through the router
    with patch("orc_api.schemas.service.subprocess.run", side_effect=subprocess_side_effect) as _:
        # deletion of service files requires sudo, instead we run mocks or run without sudo
        r = auth_client.delete("/api/service/2/")

    assert r.status_code == 204
    # check if amount of services is back to 1
    r = auth_client.get("/api/service/")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_executor_service(auth_client, mocker, monkeypatch):
    # create a service with executor
    def mock_deploy_service(*args, **kwargs):
        return True

    def mock_stop_service(*args, **kwargs):
        return {"status": "success", "message": "Service stopped successfully."}

    def mock_start_service(*args, **kwargs):
        return {"status": "success", "message": "Service started successfully."}

    def mock_restart_service(*args, **kwargs):
        return {"status": "success", "message": "Service restarted successfully."}

    def mock_enable_service(*args, **kwargs):
        return {"status": "success", "message": "Service enabled successfully."}

    def mock_disable_service(*args, **kwargs):
        return {"status": "success", "message": "Service disabled successfully."}

    def mock_get_service_status(*args, **kwargs):
        return {"status_message": "Service is running.", "is_active": True, "is_enabled": True}

    monkeypatch.setattr(schemas.service.ServiceExecutor, "deploy_service", mock_deploy_service)
    monkeypatch.setattr(schemas.service.ServiceExecutor, "enable_service", mock_enable_service)
    monkeypatch.setattr(schemas.service.ServiceExecutor, "disable_service", mock_disable_service)
    monkeypatch.setattr(schemas.service.ServiceExecutor, "stop_service", mock_stop_service)
    monkeypatch.setattr(schemas.service.ServiceExecutor, "start_service", mock_start_service)
    monkeypatch.setattr(schemas.service.ServiceExecutor, "restart_service", mock_restart_service)
    monkeypatch.setattr(schemas.service.ServiceExecutor, "get_service_status", mock_get_service_status)

    service = schemas.service.ServiceCreate(
        service_short_name="executor-service",
        service_long_name="Executor Service",
        service_type=ServiceType.ONE_TIME,
        description="This is a test service with executor.",
    )
    # first call without DEV_MODE, expected is 403 because executor is not allowed to be used without DEV_MODE
    r = auth_client.post("/api/service/", json=service.model_dump(mode="json"))
    assert r.status_code == 403
    # now call with DEV_MODE, expected is 201 and service is created successfully
    mocker.patch("orc_api.routers.service.DEV_MODE", True)
    r = auth_client.post("/api/service/", json=service.model_dump(mode="json"))
    assert r.status_code == 201
    service_id = r.json()["id"]
    # get the service and check if executor is included
    r = auth_client.get(f"/api/service/{service_id}/")
    assert r.status_code == 200
    param = schemas.service.ServiceParameterCreate(
        parameter_short_name="param",
        parameter_long_name="Parameter",
        parameter_type=schemas.service.ParameterType.INTEGER,
        default_value="0",
        nullable=False,
    )
    r = auth_client.post(f"/api/service/{service_id}/parameters/", json=param.model_dump(mode="json"))
    assert r.status_code == 200
    # now we are ready to deploy the service and check if executor is called
    script_content = "#!/bin/bash\necho Hello World"
    r = auth_client.post(f"/api/service/{service_id}/deploy/", params={"script_content": script_content})
    assert r.status_code == 200
    # start and stop
    r = auth_client.post(f"/api/service/{service_id}/start/")
    assert r.status_code == 200
    r = auth_client.post(f"/api/service/{service_id}/stop/")
    assert r.status_code == 200
    r = auth_client.post(f"/api/service/{service_id}/restart/")
    assert r.status_code == 200
    r = auth_client.post(f"/api/service/{service_id}/enable/")
    assert r.status_code == 200
    r = auth_client.post(f"/api/service/{service_id}/disable/")
    assert r.status_code == 200
    # check status
    r = auth_client.get(f"/api/service/{service_id}/status/")
    assert r.status_code == 200
    assert r.json()["status_message"] == "Service is running."
