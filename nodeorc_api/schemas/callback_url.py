import requests

from datetime import datetime, timedelta
from pydantic import BaseModel, Field, ConfigDict, AnyHttpUrl
from urllib.parse import urljoin
from nodeorc.db import DeviceStatus, DeviceFormStatus

# Pydantic model for responses
class CallbackUrlBase(BaseModel):
    url: AnyHttpUrl = Field(description="Callback URL")

class CallbackUrlResponse(CallbackUrlBase):
    id: int = Field(description="Callback URL ID")
    created_at: datetime = Field(description="Creation date")
    token_refresh_end_point: str = Field(description="Endpoint for refreshing the access token")
    token_access: str = Field(description="Access token for the callback URL")
    token_refresh: str = Field(description="Refresh token for the callback URL")
    token_expiration: datetime = Field(description="Expiration date of the access token")

    model_config = ConfigDict(from_attributes=True)

class CallbackUrlCreate(CallbackUrlBase):
    user: str = Field(description="User name for the callback URL")
    password: str = Field(description="Password for the callback URL")

    def get_tokens(self):
        url = urljoin(self.url, "/api/token/")
        data = {
            "email": self.user,
            "password": self.password
        }
        response = requests.post(url, data=data)
        return response

    def get_token_expiration(self):
        # assume the token expires in 6 hours, so get a 5 hour time delay
        curtime = datetime.now()
        return curtime + timedelta(hours=5)
