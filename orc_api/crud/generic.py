"""Generic CRUD operations, used in multiple CRUD modules."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm.query import Query


def get_closest(
    query: Query,
    model: Any,
    timestamp: datetime,
    allowed_dt: Optional[float] = None,
) -> Optional[Any]:
    """Fetch the model instance closest to the given timestamp.

    This function queries to find the model instance that is closest
    to the specified timestamp. If both prior and subsequent model instances
    exist, it determines the closest one based on the absolute time difference.
    Optionally, it checks whether the closest record falls within an allowed
    time difference from the specified timestamp.

    Parameters
    ----------
    query : Queried model instances
        Database session used to query model instances of time `model`.
    model : sqlalchemy model
        based on Base
    timestamp : datetime
        The point in time for which the closest model instance is sought.
    allowed_dt : float, optional
        Maximum allowed time difference, in seconds, between the closest
        record's timestamp and the specified timestamp. If provided,
        the function raises a ValueError if no record fits within this range.

    Returns
    -------
    Model instance
        The model instance closest to the specified timestamp.

    Raises
    ------
    ValueError
        If no model instance is found or if no record is within the allowed
        time difference from the specified timestamp when `allowed_dt` is used.

    """
    # SQLite does not allow for tzinfo in a time stamp, therefore, first remove the tzinfo if it exists
    timestamp = timestamp.replace(tzinfo=None)
    before_record = query.filter(model.timestamp <= timestamp).order_by(model.timestamp.desc()).first()
    after_record = query.filter(model.timestamp > timestamp).order_by(model.timestamp).first()

    # Determine the closest record
    closest_record = None
    if before_record and after_record:
        if abs((before_record.timestamp - timestamp).total_seconds()) <= abs(
            (after_record.timestamp - timestamp).total_seconds()
        ):
            closest_record = before_record
        else:
            closest_record = after_record
    elif before_record:
        closest_record = before_record
    elif after_record:
        closest_record = after_record

    if not closest_record:
        return None
    if allowed_dt:
        # Ensure the time difference is within the allowed range
        diff = abs((closest_record.timestamp - timestamp).total_seconds())
        if diff > allowed_dt:
            return None
    return closest_record
