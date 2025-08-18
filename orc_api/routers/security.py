"""Security endpoints."""

from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException

from orc_api import ALGORITHM, SECRET_KEY, crud
from orc_api.database import get_db
from orc_api.db import Session

router: APIRouter = APIRouter(prefix="/security", tags=["security"])


def create_token():
    """Create a JWT token."""
    payload = {
        "exp": datetime.now(UTC) + timedelta(minutes=30),  # Token expires in 1 hour
        "sub": "user",  # Example subject claim
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login")
def login(password: str, db: Session = Depends(get_db)):
    """Retrieve a JWT token with password."""
    # Check password validity
    if crud.login.verify(db, password):
        token = create_token()
        return {"access_token": token, "token_type": "Bearer"}
    raise HTTPException(status_code=401, detail="Invalid password")


@router.post("/set_password")
def set_or_update_password(password: str, db: Session = Depends(get_db)):
    """Set or update the password. Updating only works with a valid existing JWT token."""
    if crud.login.get(db):  # Check if password exists.
        crud.login.update(db, password)
        return {"message": "Password updated successfully."}
    else:
        crud.login.create(db, password)
        return {"message": "Password set successfully."}
