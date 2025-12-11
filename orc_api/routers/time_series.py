"""Time series routers."""

from typing import Dict

from fastapi import (  # Requests holds the app
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import TimeSeries
from orc_api.schemas.time_series import TimeSeriesCreate, TimeSeriesPatch, TimeSeriesResponse

router: APIRouter = APIRouter(prefix="/time_series", tags=["time_series"])


def get_time_series_record(db: Session, id: int) -> TimeSeriesResponse:
    """Retrieve a time series record from the database."""
    ts_rec = crud.time_series.get(db=db, id=id)
    if not ts_rec:
        raise HTTPException(status_code=404, detail="Time series not found.")
    # Open the video file
    return TimeSeriesResponse.model_validate(ts_rec)


@router.get("/{id}/", response_model=TimeSeriesResponse, status_code=200)
async def get_time_series(id: int, db: Session = Depends(get_db)):
    """Retrieve metadata for a video."""
    return get_time_series_record(db, id)


@router.patch("/{id}/", status_code=200, response_model=TimeSeriesResponse)
async def patch_time_series(id: int, time_series: Dict, db: Session = Depends(get_db)):
    """Update a time series record in the database."""
    # validate
    _ = TimeSeriesPatch.model_validate(time_series)
    ts = crud.time_series.update(db=db, id=id, time_series=time_series)
    return ts


@router.post("/", status_code=201, response_model=TimeSeriesResponse)
async def post_time_series(time_series: TimeSeriesCreate, db: Session = Depends(get_db)):
    """Add a time series record in the database."""
    # validate
    new_ts = TimeSeries(**time_series.model_dump(exclude_none=True, exclude={"id"}))
    ts = crud.time_series.add(db=db, time_series=new_ts)
    return ts
