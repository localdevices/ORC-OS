"""Callback URL schema."""

import functools
import time
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

import requests
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from orc_api import crud
from orc_api import db as models
from orc_api.database import get_session


def dynamic_retry(timeout, retry_delay=5.0):
    """Decorate a function to retry with a specified timeout dynamically."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            while True:
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.ConnectionError as e:
                    # Check if retry timeout has passed
                    if time.time() - start_time > timeout:
                        raise TimeoutError(f"Retry timeout exceeded ({timeout} seconds): {e}") from e
                    time.sleep(retry_delay)

        return wrapper

    return decorator


# Pydantic model for responses
class CallbackUrlBase(BaseModel):
    """Base model for callback URL."""

    url: AnyHttpUrl = Field(description="Callback URL")

    def get_token_expiration(self):
        """Return token expiration datetime."""
        # assume the token expires in 6 hours, so get a 5-hour time delay
        curtime = datetime.now()
        return curtime + timedelta(hours=5)


class CallbackUrlResponse(CallbackUrlBase):
    """Response model for callback URL, linked to database."""

    id: int = Field(description="Callback URL ID")
    created_at: datetime = Field(description="Creation date")
    retry_timeout: float = Field(description="Timeout for requests", default=0.0)
    token_refresh_end_point: str = Field(description="Endpoint for refreshing the access token")
    token_access: str = Field(description="Access token for the callback URL")
    token_refresh: str = Field(description="Refresh token for the callback URL")
    token_expiration: datetime = Field(description="Expiration date of the access token")
    model_config = ConfigDict(from_attributes=True)

    def __getattribute__(self, name):
        """Override attribute access in case a get, patch, post method is called.

        In those cases, the method should be retried until a timeout is reached. A wrapper function is used
        to do this.
        """
        orig_attr = object.__getattribute__(self, name)

        # Check if the retrieved attribute is a callable (e.g., a method) and needs retry handling
        if callable(orig_attr) and name in {"get", "patch", "post", "get_set_refresh_tokens", "get_site", "get_tokens"}:
            # Wrap the method with retry logic dynamically
            @functools.wraps(orig_attr)
            def wrapped(*args, **kwargs):
                retry_timeout = self.retry_timeout
                if retry_timeout > 0:  # Only apply retry if timeout is greater than zero
                    return dynamic_retry(retry_timeout)(orig_attr)(*args, **kwargs)
                return orig_attr(*args, **kwargs)

            return wrapped

        # Return the original attribute for non-callables or other methods
        return orig_attr

    @property
    def headers(self):
        """Return headers for requests."""
        if self.has_token:
            return {"Authorization": f"Bearer {self.token_access}"}
        else:
            return {}

    @property
    def has_token(self):
        """Check if the callback URL has a valid token."""
        return self.token_refresh is not None

    def get_set_refresh_tokens(self):
        """Refresh tokens and store them in the database."""
        url = urljoin(str(self.url), "/api/token/refresh/")
        data = {"refresh": self.token_refresh}
        response = requests.post(url, data=data, timeout=5)
        if response.status_code == 200:
            # store new tokens
            self.token_access = response.json().get("access")
            self.token_refresh = response.json().get("refresh")
            self.token_expiration = self.get_token_expiration()
            # store in database with temporary connection
            with get_session() as db:
                self.set_tokens(db)
        else:
            raise Exception(
                f"Error refreshing tokens, response code: {response.status_code}, response: {response.text}"
            )
        with get_session() as db:
            return crud.callback_url.get(db)

    def set_tokens(self, db: Session):
        """Store tokens in the database."""
        new_callback_url = self.model_dump(exclude={"id", "created_at"})
        # serialize url
        new_callback_url["url"] = str(new_callback_url["url"])
        crud.callback_url.add(db, models.CallbackUrl(**new_callback_url))

    def get(
        self,
        endpoint,
        data=None,
    ):
        """Perform GET request on end point with optional data."""
        data = {} if data is None else data
        url = urljoin(str(self.url), endpoint)
        if self.token_expiration < datetime.now():
            # first get a new token
            self.get_set_refresh_tokens()
        return requests.get(url, json=data, headers=self.headers, timeout=5)

    def patch(self, endpoint, json=None, data=None, files=None, timeout=5, delay_retry=5):
        """Perform PATCH request on end point with optional data and files."""
        data = {} if data is None else data
        files = {} if files is None else files
        url = urljoin(str(self.url), endpoint)
        if self.token_expiration < datetime.now():
            # first get a new token
            self.get_set_refresh_tokens()
        return requests.patch(
            url, headers=self.headers, data=data, json=json, files=files, timeout=timeout, allow_redirects=True
        )

    def post(self, endpoint, data=None, json=None, files=None, timeout=5, delay_retry=5):
        """Perform POST request on end point with optional data and files."""
        # data = {} if data is None else data
        # files = {} if files is None else files
        # json = {} if json is None else json
        url = urljoin(str(self.url), endpoint)
        if self.token_expiration < datetime.now():
            # first get a new token
            self.get_set_refresh_tokens()
        return requests.post(url, headers=self.headers, json=json, data=data, files=files, timeout=timeout)

    def get_online_status(self):
        """Check if the callback URL is online and the token is valid, return health parameters."""
        try:
            # Check if server is reachable
            api_endpoint = urljoin(str(self.url), "/api")
            health_response = requests.get(api_endpoint, timeout=5)  # Adjust timeout as needed
            server_online = health_response.status_code == 200

            if not server_online:
                return CallbackUrlHealth(serverOnline=False, tokenValid=False, error="Server is unreachable")

            # Check token validity
            api_endpoint = urljoin(str(self.url), "/api/recipe/")
            token_response = self.get(api_endpoint)
            # return status
            return CallbackUrlHealth(
                serverOnline=True,
                tokenValid=token_response.status_code == 200,
            )
        # no response so all health checks false
        except requests.RequestException as e:
            return CallbackUrlHealth(serverOnline=False, tokenValid=False, error=str(e))

    def get_site(self, site_id: int):
        """Get site information from the callback URL."""
        endpoint = f"/api/site/{site_id}/"
        return self.get(endpoint)


class CallbackUrlCreate(CallbackUrlBase):
    """Request model for creating a callback URL."""

    user: str = Field(description="User name for the callback URL")
    password: str = Field(description="Password for the callback URL")
    retry_timeout: float = Field(description="Retry timeout in seconds", default=0.0)

    def __getattribute__(self, name):
        """Override attribute access in case a get, patch, post method is called.

        In those cases, the method should be retried until a timeout is reached.
        """
        orig_attr = object.__getattribute__(self, name)

        # Check if the retrieved attribute is a callable (e.g., a method) and needs retry handling
        if callable(orig_attr) and name in {"get_tokens"}:
            # Wrap the method with retry logic dynamically
            @functools.wraps(orig_attr)
            def wrapped(*args, **kwargs):
                retry_timeout = self.retry_timeout
                if retry_timeout > 0:  # Only apply retry if timeout is greater than zero
                    return dynamic_retry(retry_timeout)(orig_attr)(*args, **kwargs)
                return orig_attr(*args, **kwargs)

            return wrapped

        # Return the original attribute for non-callables or other methods
        return orig_attr

    def get_tokens(self):
        """Get tokens for the callback URL using email/password."""
        url = urljoin(str(self.url), "/api/token/")
        data = {"email": self.user, "password": self.password}
        response = requests.post(url, data=data, timeout=5)
        return response


class CallbackUrlHealth(BaseModel):
    """Response model for callback URL health, not linked to database."""

    serverOnline: Optional[bool] = None
    tokenValid: Optional[bool] = None
    error: Optional[str] = None
