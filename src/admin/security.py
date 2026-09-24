import os
import hashlib
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlmodel import Session

from .DataBase import get_session
from .models import Status, User, UserRole

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def secret_key() -> str:
    value = os.getenv("JWT_SECRET", "")
    if len(value) < 32:
        raise RuntimeError("JWT_SECRET must contain at least 32 characters.")
    return value


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters.")
    return pwd_context.hash(password[:72])


def create_access_token(data: dict) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, secret_key(), algorithm=ALGORITHM)


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: Session = Depends(get_session),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, secret_key(), algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise unauthorized from None
    user = session.get(User, user_id)
    if not user or user.role != UserRole.ADMIN or user.status != Status.ACTIVE:
        raise unauthorized
    if payload.get("pwd") != hashlib.sha256(user.password_hash.encode()).hexdigest():
        raise unauthorized
    return user
