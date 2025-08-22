"""Authentication endpoints."""

from datetime import datetime, timedelta, timezone

# from datetime import UTC  # TODO: uncomment when deprecating python3.9
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from orc_api import ALGORITHM, ORC_COOKIE_MAX_AGE, ORC_COOKIE_NAME, SECRET_KEY, crud
from orc_api.database import get_db
from orc_api.db import Session

router: APIRouter = APIRouter(prefix="/auth", tags=["auth"])

UTC = timezone.utc


def create_token():
    """Create a JWT token."""
    payload = {
        "exp": datetime.now(UTC) + timedelta(minutes=15),  # Token expires in 1 hour
        "sub": "user",  # Example subject claim
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    # TODO: python3.9 Raspi versions have a bug with the return type of jwt.encode. The type is bytes but should be str
    # TODO: therefore, the capture below can be removed once we depreciate python3.9
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


@router.get("/password_available")
def password_available(db: Session = Depends(get_db)):
    """Check if a password is available."""
    if crud.login.get(db):
        return True
    else:
        return False


@router.post("/login")
def login(password: str, response: Response, db: Session = Depends(get_db)):
    """Retrieve a JWT token with password."""
    # Check password validity
    if crud.login.verify(db, password):
        token = create_token()
        response.set_cookie(
            key=ORC_COOKIE_NAME,
            value=token,
            httponly=True,
            max_age=ORC_COOKIE_MAX_AGE,
            # secure=True,  # only use for https
            samesite=None,
        )
        return {"access_token": token, "token_type": "Bearer"}
    raise HTTPException(status_code=401, detail="Invalid password")


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout the user by blacklisting the JWT token."""
    response.delete_cookie(ORC_COOKIE_NAME)
    return {"message": "Successfully logged out."}


@router.get("/verify")
def verify_token(request: Request):
    """Verify if the cookie contains a valid token.

    If the token is valid, return its claims (decoded payload).
    """
    token = request.cookies.get(ORC_COOKIE_NAME)  # retrieve token from client-side cookie
    if not token:
        raise HTTPException(status_code=401, detail="Token not found in cookies")

    try:
        # Decode and verify the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"detail": "Token is valid", "payload": payload}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token is invalid")


@router.post("/set_password")
def set_or_update_password(password: str, db: Session = Depends(get_db)):
    """Set or update the password. Updating only works with a valid existing JWT token."""
    if crud.login.get(db):  # Check if password exists.
        crud.login.update(db, password)
        return {"message": "Password updated successfully."}
    else:
        crud.login.create(db, password)
        return {"message": "Password set successfully."}
