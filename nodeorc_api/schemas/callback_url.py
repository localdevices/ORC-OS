import requests

from datetime import datetime, timedelta
from pydantic import BaseModel, Field, ConfigDict, AnyHttpUrl
from urllib.parse import urljoin
from nodeorc import db as models
from nodeorc_api import crud
from nodeorc_api.database import get_db
from typing import Optional

# Pydantic model for responses
class CallbackUrlBase(BaseModel):
    url: AnyHttpUrl = Field(description="Callback URL")

    def get_token_expiration(self):
        # assume the token expires in 6 hours, so get a 5 hour time delay
        curtime = datetime.now()
        return curtime + timedelta(hours=5)


class CallbackUrlResponse(CallbackUrlBase):
    id: int = Field(description="Callback URL ID")
    created_at: datetime = Field(description="Creation date")
    token_refresh_end_point: str = Field(description="Endpoint for refreshing the access token")
    token_access: str = Field(description="Access token for the callback URL")
    token_refresh: str = Field(description="Refresh token for the callback URL")
    token_expiration: datetime = Field(description="Expiration date of the access token")
    model_config = ConfigDict(from_attributes=True)

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token_access}"}

    def get_set_refresh_tokens(self):
        url = urljoin(str(self.url), "/api/token/refresh")
        data = {
            "refresh": self.token_refresh
        }
        response = requests.post(url, data=data, timeout=5)
        if response.status_code == 200:
            # store new tokens
            self.token_access = response.json().get("access")
            self.token_refresh = response.json().get("refresh")
            self.token_expiration = self.get_token_expiration()
            # store in database
            self.set_tokens()
        else:
            raise Exception(f"Error refreshing tokens, response code: {response.status_code}, response: {response.text}")
        return crud.callback_url.get(next(get_db()))

    def set_tokens(self):
        """Store tokens in the database."""
        db = next(get_db())
        new_callback_url = self.model_dump(exclude={"id", "created_at"})
        # serialize url
        new_callback_url["url"] = str(new_callback_url["url"])
        crud.callback_url.add(db, models.CallbackUrl(**new_callback_url))

    def get(self, url):
        if self.token_expiration < datetime.now():
            # first get a new token
            self.get_set_refresh_tokens()
        return requests.get(url, headers=self.headers, timeout=5)

    def get_online_status(self):
        try:
            # Check if server is reachable
            api_endpoint = urljoin(str(self.url), "/api")
            health_response = requests.get(api_endpoint, timeout=5)  # Adjust timeout as needed
            server_online = health_response.status_code == 200

            if not server_online:
                return CallbackUrlHealth(
                    serverOnline=False,
                    tokenValid=False,
                    error="Server is unreachable"
                )

            # Check token validity
            api_endpoint = urljoin(str(self.url), "/api/recipe/")
            token_response = self.get(api_endpoint)
            # return status
            return CallbackUrlHealth(
                serverOnline=True,
                tokenValid=token_response.status_code == 200,
            )
        except requests.RequestException as e:
            return CallbackUrlHealth(
                serverOnline=False,
                tokenValid=False,
                error=str(e)
            )

class CallbackUrlCreate(CallbackUrlBase):
    user: str = Field(description="User name for the callback URL")
    password: str = Field(description="Password for the callback URL")

    def get_tokens(self):
        url = urljoin(str(self.url), "/api/token/")
        data = {
            "email": self.user,
            "password": self.password
        }
        response = requests.post(url, data=data)
        return response


class CallbackUrlHealth(BaseModel):
    serverOnline: bool
    tokenValid: bool
    error: Optional[str] = None