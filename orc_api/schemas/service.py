"""Pydantic schemas for custom systemd services."""

import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_serializer, field_validator, model_validator

from orc_api import SERVICE_DIRECTORY
from orc_api.db.service import ParameterType, ServiceType


class ServiceParameterCreate(BaseModel):
    """Schema for creating service parameters."""

    parameter_short_name: str = Field(..., min_length=1, max_length=255)
    parameter_long_name: str = Field(..., min_length=1, max_length=255)
    parameter_type: ParameterType
    default_value: Optional[str] = None
    nullable: bool = False
    description: Optional[str] = None

    @field_validator("parameter_short_name")
    @classmethod
    def validate_short_name(cls, v: str) -> str:
        """Validate parameter short name is alphanumeric with underscores."""
        if not all(c.isalnum() or c == "_" for c in v):
            raise ValueError("parameter_short_name must be alphanumeric with underscores only")
        return v.upper()

    @field_validator("parameter_type", mode="before")
    @classmethod
    def convert_parameter_type(cls, v):
        """Convert string to ParameterType enum."""
        if isinstance(v, str):
            # get the ParameterType from string instead of integer
            return getattr(ParameterType, v)
        return v


class ServiceParameterUpdate(ServiceParameterCreate):
    """Schema for updating service parameters."""

    pass


class ServiceParameterResponse(BaseModel):
    """Schema for service parameter response."""

    id: int
    service_id: int
    parameter_short_name: str
    parameter_long_name: str
    parameter_type: ParameterType
    default_value: Optional[str]
    nullable: bool
    description: Optional[str]
    service_short_name: Optional[str] = None  # Added to provide context for reading .env file
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("parameter_type")
    def serialize_service_type(self, v: ServiceType) -> str:
        """Serialize parameter type enum to string."""
        return v.name

    @model_validator(mode="before")
    @classmethod
    def extract_service_short_name(cls, data: Any) -> Any:
        """Extract service_short_name from the service relationship if available."""
        # If data is an ORM object with a service relationship, extract service_short_name
        if hasattr(data, "service") and hasattr(data.service, "service_short_name"):
            if not hasattr(data, "service_short_name") or data.service_short_name is None:
                data.service_short_name = data.service.service_short_name
        # If data is a dict with a service object, extract from it
        elif isinstance(data, dict) and "service" in data:
            service = data["service"]
            if hasattr(service, "service_short_name") and "service_short_name" not in data:
                data["service_short_name"] = service.service_short_name

        return data

    @computed_field  # type: ignore
    @property
    def current_value(self) -> Optional[str]:
        """Get the current value from the .env file for this parameter.

        Returns
        -------
        Optional[str]
            The current value from the .env file, or None if not set

        """
        if not self.service_short_name:
            return None

        env_file_path = os.path.join(SERVICE_DIRECTORY, f"orc-{self.service_short_name}.env")

        if not os.path.isfile(env_file_path):
            return None

        try:
            with open(env_file_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        if "=" in line:
                            key, value = line.split("=", 1)
                            if key == self.parameter_short_name:
                                # Remove quotes if present
                                if value.startswith('"') and value.endswith('"'):
                                    value = value[1:-1]
                                # Unescape special characters
                                value = value.replace('\\"', '"').replace("\\$", "$")
                                return value
        except (OSError, IOError):
            # If we can't read the file, return None
            return None

        return None


class ServiceCreate(BaseModel):
    """Schema for creating custom services."""

    service_short_name: str = Field(..., min_length=1, max_length=255)
    service_long_name: str = Field(..., min_length=1, max_length=255)
    service_type: ServiceType = ServiceType.ONE_TIME
    description: Optional[str] = None
    readme: Optional[str] = None
    parameters: Optional[List[ServiceParameterCreate]] = None
    version: Optional[str] = None
    update_url: Optional[str] = None

    @field_validator("service_short_name")
    @classmethod
    def validate_short_name(cls, v: str) -> str:
        """Validate service short name is alphanumeric with hyphens."""
        if not all(c.isalnum() or c == "-" for c in v):
            raise ValueError("service_short_name must be alphanumeric with hyphens only")
        return v.lower()


class ServiceUpdate(BaseModel):
    """Schema for updating custom services."""

    service_long_name: Optional[str] = None
    description: Optional[str] = None
    readme: Optional[str] = None
    version: Optional[str] = None
    update_url: Optional[str] = None


class ServiceResponse(BaseModel):
    """Schema for service response."""

    id: int
    service_short_name: str
    service_long_name: str
    service_type: ServiceType
    description: Optional[str]
    readme: Optional[str]
    version: Optional[str]
    update_url: Optional[str]
    parameters: Optional[List[ServiceParameterResponse]] = None
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("service_type")
    def serialize_service_type(self, v: ServiceType) -> str:
        """Serialize service type enum to string."""
        return v.name


class ServiceParameterValue(BaseModel):
    """Schema for setting parameter values at runtime."""

    parameter_id: int
    value: Any


class ServiceStateResponse(BaseModel):
    """Schema for service state response."""

    service_id: int
    service_short_name: str
    is_active: bool
    is_enabled: bool
    status_message: str


class ServiceExecutor:
    """Helper class to manage systemd services and their environment variables."""

    SYSTEMD_PATH = Path("/etc/systemd/system")

    def __init__(
        self,
        service_short_name: str,
        service_long_name: str,
        service_type: ServiceType,
        parameters: Optional[List[ServiceParameterResponse]] = None,
    ):
        """Initialize service executor.

        Parameters
        ----------
        service_short_name: str
            Short name of the service
        service_long_name: str
            Long name of the service
        service_type: ServiceType
            Type of the service (e.g. one_time, scheduled)
        parameters: List[ServiceParameterResponse]
            Parameter definitions for the service

        """
        self.service_short_name = service_short_name
        self.service_long_name = service_long_name
        self.service_type = service_type
        self.parameters = parameters or []
        self.service_file_name = f"orc-{service_short_name}.service"  # no directory set here, symbolic links used
        self.timer_file_name = f"orc-{service_short_name}.timer"
        self.service_enabler = self.service_file_name if service_type == ServiceType.ONE_TIME else self.timer_file_name
        self.service_script = os.path.join(SERVICE_DIRECTORY, f"orc-{service_short_name}.sh")
        self.env_file_path = os.path.join(SERVICE_DIRECTORY, f"orc-{service_short_name}.env")
        self.log_file_path = os.path.join(SERVICE_DIRECTORY, f"orc-{service_short_name}.log")

    def create_env_file_content(self, parameter_values: Dict[int, str]) -> str:
        """Create content for environment file based on parameter values.

        Parameters
        ----------
        parameter_values: Dict[int, str]
            Dictionary mapping parameter_id to value

        Returns
        -------
        str
            Content for .env file

        """
        env_lines = []

        for param in self.parameters:
            value = parameter_values.get(param.id)

            if value is None:
                value = param.default_value

            if value is None and not param.nullable:
                raise ValueError(f"Parameter {param.parameter_short_name} is required but no value provided")

            if value is not None:
                # Escape special characters in environment variables
                if param.parameter_type == ParameterType.STRING:
                    escaped_value = str(value).replace('"', '\\"').replace("$", "\\$")
                    env_lines.append(f'{param.parameter_short_name}="{escaped_value}"')
                else:
                    env_lines.append(f"{param.parameter_short_name}={value}")

        return "\n".join(env_lines) + "\n"

    def write_env_file(self, parameter_values: Optional[Dict[int, str]] = None) -> None:
        """Write environment variables to .env file.

        Parameters
        ----------
        parameter_values: Dict[int, str]
            Dictionary mapping parameter_id to value

        """
        if not parameter_values:
            parameter_values = {}
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.env_file_path), exist_ok=True)

        # Write with restricted permissions
        with open(self.env_file_path, "w") as f:
            f.write(self.create_env_file_content(parameter_values))

        os.chmod(self.env_file_path, 0o600)

    def read_env_file(self) -> Dict[str, str]:
        """Read environment variables from .env file.

        Returns
        -------
        Dict[str, str]
            Dictionary of environment variables

        """
        if not os.path.isfile(self.env_file_path):
            return {}

        env_vars = {}
        with open(self.env_file_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key, value = line.split("=", 1)
                        # Remove quotes if present
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        env_vars[key] = value

        return env_vars

    def create_service_file(self, user: Optional[str] = None) -> str:
        """Create systemd .service file content.

        Parameters
        ----------
        user: str
            User to run service as

        Returns
        -------
        str
            Service file content

        """
        if user is None:
            user = os.getenv("USER", "root")

        service_content = f"""[Unit]
Description={self.service_long_name}
After=network-online.target time-sync.target
Wants=network-online.target time-sync.target

[Service]
Type=simple
User={user}
WorkingDirectory=/home/{user}
EnvironmentFile={self.env_file_path}
ExecStart={self.service_script}
Restart=on-failure
RestartSec=10s
StandardOutput=file:{self.log_file_path}
StandardError=file:{self.log_file_path}

[Install]
WantedBy=multi-user.target

"""

        return service_content

    def create_timer_file(self, on_boot_sec: str = "5s", frequency: int = 15) -> str:
        """Create systemd .timer file content.

        Parameters
        ----------
        on_boot_sec : str
            Delay after boot (unit file format, e.g. "5s", "1min")
        frequency : int
            Frequency in minutes for OnCalendar (e.g. 15 for every 15 minutes)

        Returns
        -------
        str
            Timer file content

        """
        timer_content = f"""[Unit]
Description={self.service_long_name} (Timer)
Requires={self.service_file_name}

[Timer]
OnBootSec={on_boot_sec}
AccuracySec=10s
OnCalendar=*:0/{frequency}
Unit={self.service_file_name}
Persistent=true

[Install]
WantedBy=timers.target
"""
        return timer_content

    def create_service_links(self) -> None:
        """Create symbolic links for service and timer files in systemd directory."""
        service_link = os.path.join(self.SYSTEMD_PATH, self.service_file_name)
        if not os.path.exists(service_link):
            service_path = os.path.join(SERVICE_DIRECTORY, self.service_file_name)
            subprocess.run(["sudo", "ln", "-sf", service_path, service_link], check=True)
        if self.service_type == ServiceType.TIMER:
            timer_link = os.path.join(self.SYSTEMD_PATH, self.timer_file_name)
            if not os.path.exists(timer_link):
                timer_path = os.path.join(SERVICE_DIRECTORY, self.timer_file_name)
                subprocess.run(["sudo", "ln", "-sf", timer_path, timer_link], check=True)

    def deploy_service(
        self,
        script_content: str,
        parameter_values: Optional[Dict[int, str]] = None,
        on_boot_sec: str = "5s",
        frequency: int = 15,
        user: Optional[str] = None,
    ) -> None:
        """Deploy service files to systemd and write env file.

        Parameters
        ----------
        script_content: str
            Content of script or program to execute within the service. Only set here to prevent script insertion
        timer_content: str, optional
            Content of .timer file
        parameter_values: dict, optional
            Dictionary mapping parameter_id to value
        on_boot_sec : str
            Delay after boot (unit file format, e.g. "5s", "1min")
        frequency : int
            Frequency in minutes for OnCalendar (e.g. 15 for every 15 minutes)
        user: str
            User to run service as

        """
        # write the env file if parameters are provided. This can be overridden by the user later, but ensures that
        # defaults are set if no values provided at runtime.
        self.write_env_file(parameter_values)  # if parameter_values is None, it will be set to empty dict
        # Write script file
        with open(self.service_script, "w") as f:
            f.write(script_content)
        # script MUST be executable
        os.chmod(self.service_script, 0o755)
        # Write service file
        service_path = os.path.join(SERVICE_DIRECTORY, self.service_file_name)
        with open(service_path, "w") as f:
            f.write(self.create_service_file(user=user))

        # Write timer file if provided
        if self.service_type == ServiceType.TIMER:
            timer_content = self.create_timer_file(on_boot_sec=on_boot_sec, frequency=frequency)
            timer_path = os.path.join(SERVICE_DIRECTORY, self.timer_file_name)
            with open(timer_path, "w") as f:
                f.write(timer_content)
        # Reload systemd
        self.create_service_links()
        subprocess.run(["sudo", "systemctl", "daemon-reload"], check=True)

    def enable_service(self) -> str:
        """Enable the service/timer.

        Returns:
            Output message

        """
        # check if symlink to service exists in systemd directory, if not, create the symbolic link as super-user
        self.create_service_links()
        try:
            subprocess.run(
                ["sudo", "systemctl", "enable", self.service_enabler],
                check=True,
                capture_output=True,
            )
            return f"Service {self.service_short_name} enabled"
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to enable service: {e.stderr.decode()}")

    def disable_service(self) -> str:
        """Disable the service/timer.

        Returns:
            Output message

        """
        try:
            subprocess.run(
                ["sudo", "systemctl", "disable", self.service_enabler],
                check=True,
                capture_output=True,
            )
            return f"Service {self.service_short_name} disabled"
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to disable service: {e.stderr.decode()}")

    def start_service(self) -> str:
        """Start the service.

        Returns:
            Output message

        """
        try:
            subprocess.run(
                ["sudo", "systemctl", "start", self.service_enabler],
                check=True,
                capture_output=True,
            )
            return f"Service {self.service_short_name} started"
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to start service: {e.stderr.decode()}")

    def stop_service(self) -> str:
        """Stop the service.

        Returns:
            Output message

        """
        try:
            subprocess.run(
                ["sudo", "systemctl", "stop", self.service_enabler],
                check=True,
                capture_output=True,
            )
            return f"Service {self.service_short_name} stopped"
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to stop service: {e.stderr.decode()}")

    def restart_service(self) -> str:
        """Restart the service.

        Returns:
            Output message

        """
        try:
            subprocess.run(
                ["sudo", "systemctl", "restart", self.service_enabler],
                check=True,
                capture_output=True,
            )
            return f"Service {self.service_short_name} restarted"
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to restart service: {e.stderr.decode()}")

    def get_service_status(self) -> Dict[str, Any]:
        """Get current service status.

        Returns:
            Dictionary with service status information

        """
        try:
            # Check if active
            result = subprocess.run(
                ["sudo", "systemctl", "is-active", self.service_enabler],
                capture_output=True,
                text=True,
            )
            is_active = result.returncode == 0

            # Check if enabled
            result = subprocess.run(
                ["sudo", "systemctl", "is-enabled", self.service_enabler],
                capture_output=True,
                text=True,
            )
            is_enabled = result.returncode == 0

            # Get detailed status
            result = subprocess.run(
                ["sudo", "systemctl", "status", self.service_file_name],  # use filename to check if service is running
                capture_output=True,
                text=True,
            )
            status_message = result.stdout

            return {
                "is_active": is_active,
                "is_enabled": is_enabled,
                "status_message": status_message,
            }
        except Exception as e:
            raise RuntimeError(f"Failed to get service status: {str(e)}")

    def delete_service(self) -> None:
        """Delete service files and environment file."""
        try:
            # Stop and disable service first
            subprocess.run(
                ["sudo", "systemctl", "stop", self.service_enabler],
                capture_output=True,
            )
            subprocess.run(
                ["sudo", "systemctl", "disable", self.service_enabler],
                capture_output=True,
            )

            # Remove files
            service_path = os.path.join(SERVICE_DIRECTORY, self.service_file_name)
            service_link = self.SYSTEMD_PATH / self.service_file_name
            timer_path = os.path.join(SERVICE_DIRECTORY, self.timer_file_name)
            timer_link = self.SYSTEMD_PATH / self.timer_file_name

            # first remove symnbolic links as super-user
            if os.path.exists(service_link):
                subprocess.run(["sudo", "rm", "-f", str(service_link)], check=True)
            if os.path.exists(timer_link):
                subprocess.run(["sudo", "rm", "-f", str(timer_link)], check=True)

            if os.path.exists(service_path):
                os.unlink(service_path)
            if os.path.exists(timer_path):
                os.unlink(timer_path)
            if os.path.exists(self.env_file_path):
                os.unlink(self.env_file_path)
            if os.path.exists(self.service_script):
                os.unlink(self.service_script)
            # Reload systemd
            subprocess.run(["sudo", "systemctl", "daemon-reload"], check=True)
        except Exception as e:
            raise RuntimeError(f"Failed to delete service: {str(e)}")


class ServiceExportData(BaseModel):
    """Schema for exporting service data to JSON."""

    service_short_name: str
    service_long_name: str
    service_type: ServiceType
    description: Optional[str]
    readme: Optional[str]
    version: str
    update_url: Optional[str]
    parameters: List[ServiceParameterCreate]
    script_content: Optional[str] = None
    timer_frequency: Optional[int] = None
    on_boot_sec: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

    def to_json(self) -> str:
        """Convert to JSON string."""
        return self.model_dump_json(indent=4)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return self.model_dump(mode="json")

    @classmethod
    def from_json(cls, json_str: str) -> "ServiceExportData":
        """Create from JSON string."""
        return cls.model_validate_json(json_str)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ServiceExportData":
        """Create from dictionary."""
        return cls.model_validate(data)

    @field_validator("service_type", mode="before")
    @classmethod
    def convert_service_type(cls, v):
        """Convert service type string to enum."""
        if isinstance(v, str):
            return getattr(ServiceType, v)
        return v


class ServiceImportRequest(BaseModel):
    """Schema for importing service from JSON."""

    service_data: ServiceExportData
    preserve_env: bool = True

    model_config = ConfigDict(from_attributes=True)


class ServiceVersionCheck(BaseModel):
    """Schema for version check response."""

    current_version: str
    latest_version: Optional[str]
    update_available: bool
    update_url: Optional[str]

    model_config = ConfigDict(from_attributes=True)
