from orc_api import crud, db, schemas
from orc_api.db.service import ServiceType


def test_service_add(session_water_levels, monkeypatch):
    # patch the database
    monkeypatch.setattr("orc_api.database.get_session", lambda: session_water_levels)

    service = schemas.service.ServiceCreate(
        service_short_name="some-service",
        service_long_name="Some Service",
        service_type=ServiceType.ONE_TIME,
        description="This is a test service.",
    )
    service = crud.service.create_service(session_water_levels, service)
    # add a parameter to the service
    param = schemas.service.ServiceParameterCreate(
        parameter_short_name="param1",
        parameter_long_name="Parameter 1",
        parameter_type=schemas.service.ParameterType.STRING,
        default_value="default",
        nullable=False,
        description="This is a test parameter.",
    )
    param = crud.service.add_service_parameter(db=session_water_levels, service_id=service.id, param=param)
    session_water_levels.refresh(param)
    session_water_levels.refresh(service)
    session_water_levels.flush()
    # test if parameter is linked to service
    assert len(service.parameters) == 1
    assert service.parameters[0].parameter_short_name == "param1".upper()
    assert service.id == 1
    # get the service and check if parameter is included
    service_from_db = crud.service.get_service(session_water_levels, service_id=service.id)
    assert service_from_db is not None
    assert len(service_from_db.parameters) == 1
    assert service_from_db.parameters[0].parameter_short_name == "param1".upper()
    # update the parameter
    param_update = schemas.service.ServiceParameterUpdate(
        parameter_short_name="param1_updated",
        parameter_long_name="Parameter 1 Updated",
        parameter_type=schemas.service.ParameterType.STRING,
    )
    assert param is not None
    updated_param = crud.service.update_service_parameter(
        db=session_water_levels, param_id=param.id, param_update=param_update
    )
    session_water_levels.refresh(updated_param)
    # now also update service
    service_update = schemas.service.ServiceUpdate(
        service_long_name="Some Service Updated",
    )
    updated_service = crud.service.update_service(
        db=session_water_levels, service_id=service.id, service_update=service_update
    )
    session_water_levels.refresh(updated_service)
    # check if updates are correct
    assert updated_param is not None
    assert updated_service is not None
    assert updated_service.parameters[0].parameter_short_name == "param1_updated".upper()
    assert updated_service.service_long_name == "Some Service Updated"
    # delete the service and check if parameter is also deleted
    deleted = crud.service.delete_service(session_water_levels, service_id=service.id)
    assert deleted
    service_from_db = crud.service.get_service(session_water_levels, service_id=service.id)
    assert service_from_db is None
    param_from_db = session_water_levels.query(db.service.ServiceParameter).filter_by(id=param.id).first()
    assert param_from_db is None
