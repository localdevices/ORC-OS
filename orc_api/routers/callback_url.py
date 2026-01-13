"""Routes for managing LiveORC callback URL information."""

from typing import Union

from fastapi import APIRouter, Depends, Response

from orc_api import crud
from orc_api.database import get_db
from orc_api.db import CallbackUrl, Session
from orc_api.schemas.callback_url import CallbackUrlCreate, CallbackUrlHealth, CallbackUrlResponse

router: APIRouter = APIRouter(prefix="/callback_url", tags=["callback_url"])


@router.get(
    "/",
    response_model=Union[CallbackUrlResponse, None],
    description="Get LiveORC callback URL information for callback",
)
async def get_callback_url(db: Session = Depends(get_db)):
    """Route for getting LiveORC callback URL information."""
    callback_url = crud.callback_url.get(db)
    return callback_url


@router.get(
    "/health/",
    response_model=CallbackUrlHealth,
    description="Check the online status and token health of LiveORC callback URL",
)
async def get_callback_url_health(db: Session = Depends(get_db)):
    """Route for checking the online status and token health of LiveORC callback URL."""
    callback_url = crud.callback_url.get(db)
    if not callback_url:
        return CallbackUrlHealth(serverOnline=None, tokenValid=None, error="No callback URL found")
    callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(db))
    callback_url_health = callback_url.get_online_status()
    return callback_url_health


@router.get(
    "/refresh_tokens/",
    response_model=CallbackUrlResponse,
    status_code=200,
    description="Refresh the access token of LiveORC callback URL",
)
async def refresh_callback_url_token(db: Session = Depends(get_db)):
    """Route for refreshing the access/refresh tokens of LiveORC callback URL."""
    callback_url = CallbackUrlResponse.model_validate(crud.callback_url.get(db))
    new_callback_url = callback_url.get_set_refresh_tokens()
    return new_callback_url


@router.delete("/", response_model=None, status_code=204, description="Delete LiveORC callback URL information")
async def delete_callback_url(db: Session = Depends(get_db)):
    """Route for deleting LiveORC callback URL information."""
    crud.callback_url.delete(db)
    return


@router.post(
    "/",
    response_model=CallbackUrlResponse,
    status_code=201,
    description="Post or update LiveORC callback URL information",
)
async def update_callback_url(callback_url: CallbackUrlCreate, db: Session = Depends(get_db)):
    """Route for posting or updating LiveORC callback URL information."""
    # check if url has the /api suffix
    if callback_url.user == "" or callback_url.password == "" or callback_url.url == "":
        # check if there is already a record and add the time to it
        callback_stored = crud.callback_url.get(db)
        # if site id provided, also check if user has access to site id.
        if callback_url.remote_site_id is not None:
            callback_response = CallbackUrlResponse.model_validate(callback_stored)
            r = callback_response.get(f"/api/site/{callback_url.remote_site_id}/")
            if not r.status_code == 200:
                return Response(
                    f"Error: site {callback_url.remote_site_id} does not exists or is not accessible for user",
                    status_code=r.status_code,
                )
        if callback_stored:
            # only update timeout if needed.
            crud.callback_url.update(
                db, {"retry_timeout": callback_url.retry_timeout, "remote_site_id": callback_url.remote_site_id}
            )
            return Response(
                "No user, and/or no password set, so only updated retry timeout and site id.", status_code=200
            )
        else:
            return Response("No url and/or user and/or password set, cannot create callback url.", status_code=400)
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
    # if site id provided, also check if user has access to site id.
    new_callback_url = crud.callback_url.add(db, new_callback_url)
    if new_callback_url.remote_site_id is not None:
        callback_response = CallbackUrlResponse.model_validate(new_callback_url)
        r = callback_response.get(f"/api/site/{callback_url.remote_site_id}/")
        if not r.status_code == 200:
            # remove the site id from the record
            # crud.callback_url.delete(db)
            new_callback_url.remote_site_id = None
            db.commit()
            db.refresh(new_callback_url)
            # crud.callback_url.add(db, new_callback_url)

            return Response(
                f"Stored url, but site {callback_url.remote_site_id} does not exists or is not accessible for user",
                status_code=201,
            )

    return Response("Callback url created.", status_code=201)
