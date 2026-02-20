"""Router for custom systemd service management."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from orc_api.crud import service as crud
from orc_api.database import get_db
from orc_api.schemas.service import (
    ServiceCreate,
    ServiceExecutor,
    ServiceParameterCreate,
    ServiceParameterResponse,
    ServiceParameterUpdate,
    ServiceResponse,
    ServiceStateResponse,
    ServiceUpdate,
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

        # # Create service file
        # service_content = executor.create_service_file(
        #     service.service_long_name, exec_start
        # )

        # # Create timer file if needed
        # timer_content = None
        # if service.service_type == ServiceType.TIMER:
        #     timer_content = executor.create_timer_file(
        #         service.service_long_name,
        #         on_boot_sec=on_boot_sec,
        #         frequency=frequency,
        #     )

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
