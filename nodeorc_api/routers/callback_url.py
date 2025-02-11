from fastapi import APIRouter, Depends, Response
from nodeorc.db import Session, CallbackUrl
from typing import List, Union
from urllib.parse import urljoin

from nodeorc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlResponse, CallbackUrlHealth
from nodeorc_api.database import get_db
from nodeorc_api import crud

router: APIRouter = APIRouter(prefix="/callback_url", tags=["callback_url"])

@router.get("/", response_model=Union[CallbackUrlResponse, None], description="Get LiveORC callback URL information for callback")
async def get_callback_url(db: Session = Depends(get_db)):
    callback_url = crud.callback_url.get(db)
    return callback_url


@router.get("/health", response_model=CallbackUrlHealth, description="Check the online status and token health of LiveORC callback URL")
async def get_callback_url_health(db: Session = Depends(get_db)):
    callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(db))
    callback_url_health = callback_url.get_online_status()
    return callback_url_health


@router.get("/refresh_tokens", response_model=CallbackUrlResponse, status_code=200, description="Refresh the access token of LiveORC callback URL")
async def refresh_callback_url_token(db: Session = Depends(get_db)):
    callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(db))
    new_callback_url = callback_url.get_set_refresh_tokens()
    return new_callback_url


@router.post("/", response_model=CallbackUrlResponse, status_code=201, description="Post or update LiveORC callback URL information")
async def update_device(callback_url: CallbackUrlCreate, db: Session = Depends(get_db)):
    # check if url has the /api suffix
    # check if the LiveORC server can be reached and returns a valid response
    r = callback_url.get_tokens()
    if not r.status_code == 200:
        return Response(f"Error: {r.text}", status_code=r.status_code)

    data = r.json()
    token_access = data["access"]
    token_refresh = data["refresh"]
    # create a new callback with the refresh tokens
    token_expiration = callback_url.get_token_expiration()
    # make a new record stripping the provided secret
    new_callback_dict = callback_url.model_dump(exclude_none=True, mode="json", exclude={"id", "password", "user"})
    # add our newly found information from LiveORC server
    new_callback_dict.update(
        {
            "token_access": token_access,
            "token_refresh": token_refresh,
            "token_expiration": token_expiration,
        }
    )
    new_callback_url = CallbackUrl(**new_callback_dict)
    new_callback_url = crud.callback_url.add(db, new_callback_url)
    return new_callback_url
