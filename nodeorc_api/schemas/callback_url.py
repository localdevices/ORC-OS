import requests

from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from urllib.parse import urljoin
from nodeorc.db import DeviceStatus, DeviceFormStatus

# Pydantic model for responses
class CallbackUrlBase(BaseModel):
    url: str = Field(description="Callback URL")
    user: str = Field(description="User name for the callback URL")

class CallbackUrlResponse(CallbackUrlBase):
    id: int = Field(description="Callback URL ID")
    created_at: datetime = Field(description="Creation date")
    token_refresh_end_point: str = Field(description="Endpoint for refreshing the access token")
    token_access: str = Field(description="Access token for the callback URL")
    token_refresh: str = Field(description="Refresh token for the callback URL")
    token_expiration: datetime = Field(description="Expiration date of the access token")


    class Config:
        from_attributes = True

class CallbackUrlCreate(CallbackUrlBase):
    password: str = Field(description="Password for the callback URL")

    def get_tokens(self):
        url = urljoin(self.url, "/api/token/")
        data = {
            "email": self.user,
            "password": self.password
        }
        response = requests.post(url, data=data)

        if response.status_code == 200:
            data = response.json()
            return data["access"], data["refresh"]
        else:
            return None, None

    def get_expiration(self):
        # assume the token expires in 6 hours, so get a 5 hour time delay
        curtime = datetime.now()
        return curtime + timedelta(hours=5)
