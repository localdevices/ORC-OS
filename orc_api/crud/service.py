"""CRUD operations for custom services."""

from typing import List, Optional

from sqlalchemy.orm import Session

from orc_api.db.service import Service, ServiceParameter
from orc_api.schemas.service import (
    ServiceCreate,
    ServiceParameterCreate,
    ServiceUpdate,
)


def create_service(db: Session, service: ServiceCreate) -> Service:
    """Create a new custom service.

    Parameters
    ----------
    db: Session
        Database session
    service: ServiceCreate
        Service creation schema

    Returns
    -------
    Service
        Created Service instance

    """
    db_service = Service(
        service_short_name=service.service_short_name,
        service_long_name=service.service_long_name,
        service_type=service.service_type,
        description=service.description,
    )

    db.add(db_service)
    db.flush()  # Flush to get the ID

    # Add parameters if provided
    if service.parameters:
        for param in service.parameters:
            db_param = ServiceParameter(
                service_id=db_service.id,
                parameter_short_name=param.parameter_short_name,
                parameter_long_name=param.parameter_long_name,
                parameter_type=param.parameter_type,
                default_value=param.default_value,
                nullable=param.nullable,
                description=param.description,
            )
            db.add(db_param)

    db.commit()
    db.refresh(db_service)
    return db_service


def get_service(db: Session, service_id: int) -> Optional[Service]:
    """Get a custom service by ID.

    Parameters
    ----------
    db: Session
        Database session
    service_id: int
        Service ID

    Returns
    -------
    Service, optional
        Service instance or None if not found

    """
    return db.query(Service).filter(Service.id == service_id).first()


def get_service_by_short_name(db: Session, short_name: str) -> Optional[Service]:
    """Get a custom service by short name.

    Parameters
    ----------
    db: Session
        Database session
    short_name: str
        Service short name

    Returns
    -------
    Service, optional
        Service instance or None if not found

    """
    return db.query(Service).filter(Service.service_short_name == short_name).first()


def list_services(db: Session, skip: int = 0, limit: int = 100) -> List[Service]:
    """List all custom services.

    Parameters
    ----------
    db: Session
        Database session
    skip: int
        Number of records to skip
    limit: int
        Maximum number of records to return

    Returns
    -------
    List[Service]

    """
    return db.query(Service).offset(skip).limit(limit).all()


def update_service(db: Session, service_id: int, service_update: ServiceUpdate) -> Optional[Service]:
    """Update a custom service.

    Parameters
    ----------
    db: Session
        Database session
    service_id: int
        Service ID
    service_update: ServiceUpdate
        Service update schema

    Returns
    -------
    Service, optional
        Updated Service instance or None

    """
    db_service = get_service(db, service_id)
    if not db_service:
        return None

    if service_update.service_long_name is not None:
        db_service.service_long_name = service_update.service_long_name

    if service_update.description is not None:
        db_service.description = service_update.description

    db.commit()
    db.refresh(db_service)
    return db_service


def delete_service(db: Session, service_id: int) -> bool:
    """Delete a custom service and its parameters.

    Parameters
    ----------
    db: Session
        Database session
    service_id: int
        Service ID

    Returns
    -------
    bool
        True if deleted, False if not found

    """
    db_service = get_service(db, service_id)
    if not db_service:
        return False

    db.delete(db_service)
    db.commit()
    return True


def add_service_parameter(db: Session, service_id: int, param: ServiceParameterCreate) -> Optional[ServiceParameter]:
    """Add a parameter to a service.

    Parameters
    ----------
    db: Session
        Database session
    service_id: int
        Service ID
    param: ServiceParameterCreate
        Parameter creation schema

    Returns
    -------
    ServiceParameter, optional
        Created ServiceParameter instance or None if service not found

    """
    db_service = get_service(db, service_id)
    if not db_service:
        return None

    db_param = ServiceParameter(
        service_id=service_id,
        parameter_short_name=param.parameter_short_name,
        parameter_long_name=param.parameter_long_name,
        parameter_type=param.parameter_type,
        default_value=param.default_value,
        nullable=param.nullable,
        description=param.description,
    )
    db.add(db_param)
    db.commit()
    db.refresh(db_param)
    return db_param


def update_service_parameter(
    db: Session, param_id: int, param_update: ServiceParameterCreate
) -> Optional[ServiceParameter]:
    """Update a service parameter.

    Parameters
    ----------
    db: Session
        Database session
    param_id: int
        Parameter ID
    param_update: ServiceParameterCreate
        Update schema

    Returns
    -------
    ServiceParameter, optional
        Updated ServiceParameter instance or None

    """
    db_param = db.query(ServiceParameter).filter(ServiceParameter.id == param_id).first()

    if not db_param:
        return None

    db_param.parameter_short_name = param_update.parameter_short_name
    db_param.parameter_long_name = param_update.parameter_long_name
    db_param.parameter_type = param_update.parameter_type
    db_param.default_value = param_update.default_value
    db_param.nullable = param_update.nullable
    db_param.description = param_update.description

    db.commit()
    db.refresh(db_param)
    return db_param


def delete_service_parameter(db: Session, param_id: int) -> bool:
    """Delete a service parameter.

    Parameters
    ----------
    db: Session
        Database session
    param_id: int
        Parameter ID

    Returns
    -------
    bool
        True if deleted, False if not found

    """
    db_param = db.query(ServiceParameter).filter(ServiceParameter.id == param_id).first()

    if not db_param:
        return False

    db.delete(db_param)
    db.commit()
    return True


def get_service_parameter(db: Session, param_id: int) -> Optional[ServiceParameter]:
    """Get a service parameter by ID.

    Parameters
    ----------
    db: Session
        Database session
    param_id: int
        Parameter ID

    Returns
    -------
    ServiceParameter, optional
        ServiceParameter instance or None

    """
    return db.query(ServiceParameter).filter(ServiceParameter.id == param_id).first()
