from fastapi import APIRouter, Depends
from nodeorc.db import Session, CallbackUrl
from typing import List, Dict

from nodeorc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse
from nodeorc_api.database import get_db
from nodeorc_api import crud

router: APIRouter = APIRouter(prefix="/device", tags=["device"])

@router.get("/", response_model=CallbackUrlResponse, description="Get LiveORC callback URL information for callback")
async def get_callback_url(db: Session = Depends(get_db)):
    callback_url: List[CallbackUrl] = crud.callback_url.get(db)
    return callback_url


@router.post("/", response_model=CallbackUrlResponse, status_code=201, description="Post or update LiveORC callback URL information")
async def update_device(callback_url: CallbackUrlCreate, db: Session = Depends(get_db)):
    # check if the LiveORC server can be reached and returns a valid response
    token_access, token_refresh = callback_url.get_tokens()
    # create a new callback with the refresh tokens
    token_expiry = callback_url.get_token_expiry()


    # Check if there is already a device
    existing_callback_url = crud.callback_url.get(db)

    if existing_callback_url:
        # delete existing
        crud.callback_url.delete(db)
    # # Create a new device record if none exists
    # new_device = Device(**device.model_dump(exclude_none=True, exclude={"id"}))
    # db.add(new_device)
    # db.commit()
    # db.refresh(new_device)
    #     return new_device
