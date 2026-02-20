import os
import subprocess
from unittest.mock import MagicMock, patch

from orc_api.db.service import ParameterType, Service, ServiceType
from orc_api.schemas.service import ServiceExecutor, ServiceParameterResponse


def test_service_executor():
    # Create a mock service instance
    service = Service(
        id=1,
        service_short_name="test_service",
        service_long_name="Test Service",
        service_type=ServiceType.ONE_TIME,
        description="A test service",
    )

    # Create a ServiceExecutor instance using the mock service
    executor = ServiceExecutor(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        parameters=None,
    )
    # check if env content returns empty string
    assert executor.create_env_file_content({}) == "\n"

    # now create a few parameter and check if env content is correctly set to default values
    executor.parameters = [
        ServiceParameterResponse(
            id=1,
            service_id=1,
            parameter_short_name="PARAM1",
            parameter_long_name="Parameter 1",
            parameter_type=ParameterType.STRING,
            default_value="default1",
            nullable=False,
            description="First parameter",
        ),
        ServiceParameterResponse(
            id=2,
            service_id=1,
            parameter_short_name="PARAM2",
            parameter_long_name="Parameter 2",
            parameter_type=ParameterType.INTEGER,
            default_value="42",
            nullable=True,
            description="Second parameter",
        ),
    ]
    expected_env_content = 'PARAM1="default1"\nPARAM2=42\n'
    assert executor.create_env_file_content({}) == expected_env_content
    # now test WITH provided parameter values, which should override the default values
    provided_values = {
        1: "provided1",
        2: 100,
        3: "extra_param",  # this should be ignored since it doesn't match any parameter ID
    }
    expected_provided_env_content = 'PARAM1="provided1"\nPARAM2=100\n'
    assert executor.create_env_file_content(provided_values) == expected_provided_env_content


def test_service_executor_env_file(tmp_path):
    # Create a mock service instance
    service = Service(
        id=1,
        service_short_name="test_service",
        service_long_name="Test Service",
        service_type=ServiceType.ONE_TIME,
        description="A test service",
    )

    # Create a ServiceExecutor instance using the mock service
    executor = ServiceExecutor(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        parameters=[
            ServiceParameterResponse(
                id=1,
                service_id=1,
                parameter_short_name="PARAM1",
                parameter_long_name="Parameter 1",
                parameter_type=ParameterType.STRING,
                default_value="default1",
                nullable=False,
                description="First parameter",
            )
        ],
    )
    # Set env file path to a temporary file
    env_file_path = tmp_path / "test_service.env"
    executor.env_file_path = str(env_file_path)

    # Write env file with default values
    executor.write_env_file({})
    assert env_file_path.exists()
    with open(env_file_path, "r") as f:
        content = f.read()
    assert content == 'PARAM1="default1"\n'

    # Write env file with provided values
    executor.write_env_file({1: "provided1"})
    with open(env_file_path, "r") as f:
        content = f.read()
    assert content == 'PARAM1="provided1"\n'
    # also read to dict using the read_env_file method and check if it matches the provided values
    read_values = executor.read_env_file()
    assert read_values == {"PARAM1": "provided1"}


def test_service_executor_create_service_file():
    # Create a mock service instance
    service = Service(
        id=1,
        service_short_name="test-service",
        service_long_name="Test Service",
        service_type=ServiceType.ONE_TIME,
        description="A test service",
    )

    # Create a ServiceExecutor instance using the mock service
    executor = ServiceExecutor(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        parameters=None,
    )

    # Create systemd unit file content
    service_content = executor.create_service_file()
    expected_content = f"""[Unit]
Description={service.service_long_name}
"""
    assert service_content.startswith(expected_content)


def test_service_executor_deploy(tmp_path, monkeypatch):
    # monkeypatch the SERVICE_DIRECTORY to a temporary directory to avoid writing to the actual filesystem during tests
    original_run = subprocess.run

    monkeypatch.setattr("orc_api.schemas.service.SERVICE_DIRECTORY", tmp_path)
    # Create a mock service instance
    service = Service(
        id=1,
        service_short_name="test-service",
        service_long_name="Test Service",
        service_type=ServiceType.ONE_TIME,
        description="A test service",
    )

    # Create a ServiceExecutor instance using the mock service
    executor = ServiceExecutor(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        parameters=None,
    )

    # Set up temporary paths for deployment
    temp_systemd_path = tmp_path / "systemd"
    temp_systemd_path.mkdir()
    executor.SYSTEMD_PATH = temp_systemd_path

    # Deploy the service (this will create the .service file in the temp directory)
    def subprocess_side_effect(cmd, **kwargs):
        """Conditionally mock subprocess.run based on command."""
        # Only mock daemon-reload, let others run
        if cmd[1] == "systemctl":
            return MagicMock(returncode=0)
        # Let sudo commands actually run, but without the sudo since we are in a temp directory
        if cmd[0] == "sudo":
            return original_run(cmd[1:], **kwargs)
        return original_run(cmd, **kwargs)

    with patch("orc_api.schemas.service.subprocess.run", side_effect=subprocess_side_effect) as _:
        executor.deploy_service(
            script_content="echo 'Hello, World!'",
        )
    # Check if the .service file was created
    expected_service_file = temp_systemd_path / executor.service_file_name
    assert expected_service_file.exists()
    # Check if .env file was created
    assert os.path.exists(executor.env_file_path)
    # Check if symbolic link was created in the temp directory
    expected_symlink = temp_systemd_path / executor.service_file_name
    expected_timer_symlink = temp_systemd_path / executor.timer_file_name
    assert expected_symlink.exists()
    assert expected_symlink.is_symlink()
    # One-shot service, so no timer file should have been created, check that!
    expected_timer_file = temp_systemd_path / executor.timer_file_name
    assert not expected_timer_file.exists()
    assert not expected_timer_symlink.exists()
    # finally check if timer file is created when the service type is timer
    executor.service_type = ServiceType.TIMER
    with patch("subprocess.run", side_effect=subprocess_side_effect) as _:
        executor.deploy_service(
            script_content="echo 'Hello, Timer!'",
        )
    assert expected_timer_file.exists()
    assert expected_timer_symlink.exists()
    assert expected_timer_symlink.is_symlink()

    # now attempt to delete the entire service and check if files are removed
    with patch("subprocess.run", side_effect=subprocess_side_effect) as _:
        executor.delete_service()
    assert not expected_service_file.exists()
    assert not expected_timer_file.exists()
    assert not expected_symlink.exists()
    assert not expected_timer_symlink.exists()
    assert not os.path.exists(executor.env_file_path)
    assert not os.path.exists(executor.service_script)


def test_service_executor_enable_disable(tmp_path):
    # Create a mock service instance
    service = Service(
        id=1,
        service_short_name="test-service",
        service_long_name="Test Service",
        service_type=ServiceType.ONE_TIME,
        description="A test service",
    )

    # Create a ServiceExecutor instance using the mock service
    executor = ServiceExecutor(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        parameters=None,
    )

    # Set up temporary paths for deployment
    temp_systemd_path = tmp_path / "systemd"
    temp_systemd_path.mkdir()
    executor.SYSTEMD_PATH = temp_systemd_path

    # Mock subprocess.run to avoid actually enabling/disabling services on the test system
    with patch("subprocess.run") as mock_run:
        executor.enable_service()
        mock_run.assert_called_with(
            ["sudo", "systemctl", "enable", executor.service_enabler], check=True, capture_output=True
        )
        executor.disable_service()
        mock_run.assert_called_with(
            ["sudo", "systemctl", "disable", executor.service_enabler], check=True, capture_output=True
        )


def test_service_executor_start_stop(tmp_path):
    # Create a mock service instance
    service = Service(
        id=1,
        service_short_name="test-service",
        service_long_name="Test Service",
        service_type=ServiceType.ONE_TIME,
        description="A test service",
    )

    # Create a ServiceExecutor instance using the mock service
    executor = ServiceExecutor(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        parameters=None,
    )

    # Set up temporary paths for deployment
    temp_systemd_path = tmp_path / "systemd"
    temp_systemd_path.mkdir()
    executor.SYSTEMD_PATH = temp_systemd_path

    # Mock subprocess.run to avoid actually starting/stopping services on the test system
    with patch("subprocess.run") as mock_run:
        executor.start_service()
        mock_run.assert_called_with(
            ["sudo", "systemctl", "start", executor.service_enabler], check=True, capture_output=True
        )
        executor.stop_service()
        mock_run.assert_called_with(
            ["sudo", "systemctl", "stop", executor.service_enabler], check=True, capture_output=True
        )
