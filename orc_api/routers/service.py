"""Router for custom systemd service management."""

import os
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from orc_api.crud import service as crud
from orc_api.database import get_db
from orc_api.schemas.service import (
    ServiceCreate,
    ServiceExecutor,
    ServiceExportData,
    ServiceImportRequest,
    ServiceParameterCreate,
    ServiceParameterResponse,
    ServiceParameterUpdate,
    ServiceResponse,
    ServiceStateResponse,
    ServiceUpdate,
    ServiceVersionCheck,
)

router = APIRouter(prefix="/service", tags=["service"])

#    service: ServiceCreate,


@router.post("/", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(
    service: ServiceCreate,
    db: Session = Depends(get_db),
):
    """Create a new custom service."""
    # Check if service with same short name already exists
    existing = crud.get_service_by_short_name(db, service.service_short_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Service with short name '{service.service_short_name}' already exists",
        )

    db_service = crud.create_service(db, service)
    return db_service


@router.get("/", response_model=List[ServiceResponse])
def list_services(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List all custom services."""
    services = crud.list_services(db, skip=skip, limit=limit)
    return services


@router.get("/{service_id}/", response_model=ServiceResponse)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific service by ID."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    return service


@router.patch("/{service_id}/", response_model=ServiceResponse)
def update_service(
    service_id: int,
    service_update: ServiceUpdate,
    db: Session = Depends(get_db),
):
    """Update a custom service."""
    db_service = crud.update_service(db, service_id, service_update)
    if not db_service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    return db_service


@router.delete("/{service_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Delete a custom service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )

    # TODO: Stop and remove systemd files if they exist
    success = crud.delete_service(db, service_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete service",
        )


# Parameter endpoints
@router.post("/{service_id}/parameters/", response_model=ServiceParameterResponse)
def add_parameter(
    service_id: int,
    param: ServiceParameterCreate,
    db: Session = Depends(get_db),
):
    """Add a parameter to a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )

    db_param = crud.add_service_parameter(db, service_id, param)
    return db_param


@router.post("/{service_id}/update_env/", status_code=status.HTTP_200_OK)
async def update_service_env(
    service_id: int,
    parameter_values: Dict[int, str],
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Update service environment file with parameter values."""
    try:
        # Fetch service and parameters from database
        service = crud.get_service(db, service_id)
        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Service with ID {service_id} not found",
            )
        # Create response model instance to validate data
        service = ServiceResponse.model_validate(service)
        # Create ServiceExecutor instance
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            service_type=service.service_type,
            parameters=service.parameters,
        )
        # Write env file with provided parameter values
        executor.write_env_file(parameter_values)

        return {
            "message": f"Environment file updated for service {service.service_short_name}",
            "env_file_path": executor.env_file_path,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update environment file: {str(e)}")


@router.get("/{service_id}/parameters/", response_model=List[ServiceParameterResponse])
def list_parameters(
    service_id: int,
    db: Session = Depends(get_db),
):
    """List parameters for a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    return service.parameters


@router.patch("/parameters/{param_id}/", response_model=ServiceParameterResponse)
def update_parameter(
    param_id: int,
    param_update: ServiceParameterUpdate,
    db: Session = Depends(get_db),
):
    """Update a service parameter."""
    db_param = crud.update_service_parameter(db, param_id, param_update)
    if not db_param:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parameter with ID {param_id} not found",
        )
    return db_param


@router.delete("/parameters/{param_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_parameter(
    param_id: int,
    db: Session = Depends(get_db),
):
    """Delete a service parameter."""
    success = crud.delete_service_parameter(db, param_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parameter with ID {param_id} not found",
        )


# Service control endpoints
@router.post("/{service_id}/deploy/")
def deploy_service(
    service_id: int,
    script_content: str,
    on_boot_sec: str = "5s",
    frequency: int = 15,
    db: Session = Depends(get_db),
):
    """Deploy a service to systemd with environment variables.

    Parameters
    ----------
    service_id: int
        ID of the service
    script_content: str
        The content of the script to be executed by the service
    on_boot_sec: str
        For timer services, delay after boot (in seconds or time format) before first run
    frequency: int
        For timer services, how often to run the service (in minutes)
    db: Session
        Database session

    """
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    service = ServiceResponse.model_validate(service)
    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            parameters=service.parameters,
            service_type=service.service_type,
        )

        # Deploy files
        executor.deploy_service(
            script_content=script_content, on_boot_sec=on_boot_sec, frequency=frequency
        )  # deploy with default parameter values

        return {
            "status": "success",
            "message": f"Service {service.service_short_name} deployed successfully",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deployment failed: {str(e)}",
        )


@router.post("/{service_id}/start/")
def start_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Start a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    service = ServiceResponse.model_validate(service)
    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            parameters=service.parameters,
            service_type=service.service_type,
        )
        message = executor.start_service()
        return {"status": "success", "message": message}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Start failed: {str(e)}",
        )


@router.post("/{service_id}/stop/")
def stop_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Stop a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    service = ServiceResponse.model_validate(service)
    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            parameters=service.parameters,
            service_type=service.service_type,
        )
        message = executor.stop_service()
        return {"status": "success", "message": message}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stop failed: {str(e)}",
        )


@router.post("/{service_id}/restart/")
def restart_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Restart a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    service = ServiceResponse.model_validate(service)
    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            parameters=service.parameters,
            service_type=service.service_type,
        )
        message = executor.restart_service()
        return {"status": "success", "message": message}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Restart failed: {str(e)}",
        )


@router.post("/{service_id}/enable/")
def enable_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Enable a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    service = ServiceResponse.model_validate(service)
    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            parameters=service.parameters,
            service_type=service.service_type,
        )
        message = executor.enable_service()
        return {"status": "success", "message": message}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Enable failed: {str(e)}",
        )


@router.post("/{service_id}/disable/")
def disable_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Disable a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    service = ServiceResponse.model_validate(service)
    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            service_type=service.service_type,
            parameters=service.parameters,
        )
        message = executor.disable_service()
        db.commit()
        return {"status": "success", "message": message}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Disable failed: {str(e)}",
        )


@router.get("/{service_id}/status/", response_model=ServiceStateResponse)
def get_service_status(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Get current status of a service."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )
    service = ServiceResponse.model_validate(service)

    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            service_type=service.service_type,
            parameters=service.parameters,
        )
        status_info = executor.get_service_status()
        return ServiceStateResponse(
            service_id=service.id,
            service_short_name=service.service_short_name,
            is_active=status_info["is_active"],
            is_enabled=status_info["is_enabled"],
            status_message=status_info["status_message"],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status check failed: {str(e)}",
        )


# Export/Import endpoints
@router.get("/{service_id}/export/", response_model=ServiceExportData)
def export_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Export a service definition to JSON format."""
    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )

    # Read script content if it exists
    try:
        executor = ServiceExecutor(
            service_short_name=service.service_short_name,
            service_long_name=service.service_long_name,
            parameters=[ServiceParameterResponse.model_validate(p) for p in service.parameters],
            service_type=service.service_type,
        )
        script_content = None
        if executor.service_script and os.path.isfile(executor.service_script):
            with open(executor.service_script, "r") as f:
                script_content = f.read()
    except Exception:
        script_content = None

    # Convert parameters to create schemas
    parameters = [
        ServiceParameterCreate(
            parameter_short_name=p.parameter_short_name,
            parameter_long_name=p.parameter_long_name,
            parameter_type=p.parameter_type,
            default_value=p.default_value,
            nullable=p.nullable,
            description=p.description,
        )
        for p in service.parameters
    ]

    return ServiceExportData(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        description=service.description,
        readme=service.readme,
        version=service.version or "0.0.0",
        update_url=service.update_url,
        parameters=parameters,
        script_content=script_content,
    )


@router.post("/{service_id}/import/", response_model=ServiceResponse)
def import_service(
    service_id: int,
    import_request: ServiceImportRequest,
    db: Session = Depends(get_db),
):
    """Import/update a service from JSON format.

    Parameters
    ----------
    service_id : int
        ID of the service to update (or create if not exists)
    import_request : ServiceImportRequest
        Import request with service data and preserve_env flag
    db : Session
        Database session

    """
    # Check if service exists
    service = crud.get_service(db, service_id)

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )

    try:
        service_data = import_request.service_data
        preserve_env = import_request.preserve_env

        # Update service metadata
        service_update = ServiceUpdate(
            service_long_name=service_data.service_long_name,
            description=service_data.description,
            version=service_data.version,
            update_url=service_data.update_url,
        )
        db_service = crud.update_service(db, service_id, service_update)

        # Update parameters (delete old ones, add new ones)
        # Delete existing parameters
        for param in service.parameters:
            crud.delete_service_parameter(db, param.id)

        # Add new parameters
        for param in service_data.parameters:
            crud.add_service_parameter(db, service_id, param)

        # Refresh to get updated service
        db_service = crud.get_service(db, service_id)
        if db_service is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated service",
            )
        # If script content is provided, prepare for deployment
        if service_data.script_content:
            executor = ServiceExecutor(
                service_short_name=db_service.service_short_name,
                service_long_name=db_service.service_long_name,
                parameters=[ServiceParameterResponse.model_validate(p) for p in db_service.parameters],
                service_type=db_service.service_type,
            )

            # Read existing env file if preserving
            existing_env = {}
            if preserve_env:
                env_dict = executor.read_env_file()
                # Map parameter short names to parameter IDs
                for param in db_service.parameters:
                    if param.parameter_short_name in env_dict:
                        existing_env[param.id] = env_dict[param.parameter_short_name]

            # Deploy the service with the script and parameters
            executor.deploy_service(
                script_content=service_data.script_content,
                parameter_values=existing_env if preserve_env else None,
                on_boot_sec=service_data.on_boot_sec or "5s",
                frequency=service_data.timer_frequency or 15,
            )

        return ServiceResponse.model_validate(db_service)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}",
        )


@router.get("/{service_id}/version-check/", response_model=ServiceVersionCheck)
def check_version(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Check if a newer version of the service is available.

    This endpoint compares the current version with the latest version
    available at the update_url and returns whether an update is available.

    """
    import requests

    service = crud.get_service(db, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service with ID {service_id} not found",
        )

    current_version = service.version or "0.0.0"
    latest_version = None
    update_available = False

    if service.update_url:
        try:
            response = requests.get(service.update_url, timeout=10)
            response.raise_for_status()
            data = response.json()

            if "version" in data:
                latest_version = data["version"]
                # Simple version comparison (assumes semver)
                update_available = _compare_versions(current_version, latest_version) < 0
        except Exception:
            # If we can't reach the URL, just return what we have
            pass

    return ServiceVersionCheck(
        current_version=current_version,
        latest_version=latest_version,
        update_available=update_available,
        update_url=service.update_url,
    )


def _compare_versions(current: str, latest: str) -> int:
    """Compare two semantic versions.

    Returns:
        -1 if current < latest
        0 if current == latest
        1 if current > latest

    """

    def parse_version(v: str) -> tuple:
        parts = v.split(".")
        try:
            return tuple(int(p) for p in parts)
        except ValueError:
            return tuple(0 for _ in parts)

    current_parts = parse_version(current)
    latest_parts = parse_version(latest)

    # Pad with zeros if different lengths
    max_len = max(len(current_parts), len(latest_parts))
    current_parts = current_parts + (0,) * (max_len - len(current_parts))
    latest_parts = latest_parts + (0,) * (max_len - len(latest_parts))

    if current_parts < latest_parts:
        return -1
    elif current_parts > latest_parts:
        return 1
    else:
        return 0
