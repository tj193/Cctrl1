import hashlib

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import Status, User, UserRole
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):

    statement = select(User).where(User.email == form_data.username)
    user = session.exec(statement).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.role != UserRole.ADMIN or user.status != Status.ACTIVE:
        raise HTTPException(status_code=403, detail="An active administrator account is required")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value, "pwd": hashlib.sha256(user.password_hash.encode()).hexdigest()}
    )
    return {"access_token": access_token, "token_type": "bearer"}
