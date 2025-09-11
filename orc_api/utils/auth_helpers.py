"""Helper functions for authentication."""

import jwt
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from orc_api import (
    ALGORITHM,
    ORC_COOKIE_NAME,
    SECRET_KEY,
)


def verify_token(token: str):
    """Verify a JWT token."""
    try:
        # Decode and validate the token
        _ = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return None
    except jwt.ExpiredSignatureError:
        # Token has expired
        return {"detail": "Token has expired"}
    except jwt.InvalidTokenError:
        # Token is invalid for any reason
        return {"detail": "Token is invalid"}


def auth_token(request: Request):
    """Check if a token is present and verified."""
    token = request.cookies.get(ORC_COOKIE_NAME)
    try:
        if not token:  #  or not token.startswith("Bearer "):
            content = {"detail": "Token missing or not a valid token format"}
        # Verify the token
        else:
            content = verify_token(token)
        if content is not None:
            return JSONResponse(
                status_code=401,
                content=content,
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("Origin", "*"),
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Credentials": "true",
                },
            )
        else:
            return None

    except HTTPException as e:
        raise e
