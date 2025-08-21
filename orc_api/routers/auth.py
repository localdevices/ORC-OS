"""Security endpoints."""

from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from orc_api import ALGORITHM, ORC_COOKIE_MAX_AGE, ORC_COOKIE_NAME, SECRET_KEY, crud
from orc_api.database import get_db
from orc_api.db import Session

router: APIRouter = APIRouter(prefix="/auth", tags=["security"])


def create_token():
    """Create a JWT token."""
    payload = {
        "exp": datetime.now(UTC) + timedelta(seconds=15),  # Token expires in 1 hour
        "sub": "user",  # Example subject claim
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def cleanup_blacklist(blacklist):
    """Remove expired tokens from the blacklist."""
    current_time = datetime.now(UTC).timestamp()

    # Remove tokens that have expired
    blacklist.difference_update({(token, exp) for token, exp in blacklist if exp is not None and exp < current_time})


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
    # auth_header = request.headers.get("Authorization")
    # if not auth_header or not auth_header.startswith("Bearer "):
    #     raise HTTPException(status_code=401, detail="Token missing or invalid")
    #
    # # Extract the token from the Authorization header
    # token = auth_header.split(" ")[1]
    #
    # try:
    #     payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    #     exp = payload.get("exp")
    # except jwt.PyJWTError:
    #     raise HTTPException(status_code=401, detail="Invalid token")
    # print(f"BLACKLISTING: {token} with exp: {exp}")
    # # Add the token to the state blacklist in the app
    # request.app.state.token_blacklist.add((token, exp))
    #
    # # cleanup token list if necessary
    # cleanup_blacklist(request.app.state.token_blacklist)
    return {"message": "Successfully logged out."}


@router.get("/verify")
def verify_token(request: Request):
    """Verify if the cookie contains a valid token.

    If the token is valid, return its claims (decoded payload).
    """
    token = request.cookies.get(ORC_COOKIE_NAME)  # retrieve token from client-side cookie
    print(token)
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
