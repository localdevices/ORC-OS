"""Time series routers."""

from datetime import datetime
from io import BytesIO
from typing import Annotated, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query  # Requests holds the app
from fastapi.responses import StreamingResponse
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


@router.get("/", response_model=List[TimeSeriesResponse], status_code=200)
async def get_list_time_series(
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    count: Optional[int] = None,
    desc: Optional[bool] = None,
    video_config_ids: Annotated[list[int] | None, Query()] = None,
    db: Session = Depends(get_db),
):
    """Retrieve list of time series."""
    list_time_series = crud.time_series.get_list(
        db, start=start, stop=stop, count=count, desc=desc, video_config_ids=video_config_ids
    )
    return list_time_series


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


@router.post("/download/", status_code=200)
async def download(
    start: Optional[datetime] = None,
    stop: Optional[datetime] = None,
    count: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Retrieve time series from database and create a CSV file."""
    timeseries = crud.time_series.get_list(db=db, start=start, stop=stop, count=count)
    if len(timeseries) == 0:
        raise HTTPException(status_code=404, detail="No videos found in database with selected ids.")

    # Convert time series to DataFrame
    df = pd.DataFrame([ts.__dict__ for ts in timeseries])

    # Create CSV in memory
    output = BytesIO()
    df.to_csv(output, index=False)
    output.seek(0)

    # close database connection
    db.close()

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="time_series.csv"'},
    )
