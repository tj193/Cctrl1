import hashlib
import re

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import ApplicationStatus, Driver_Profile, Status, User, UserRole
from ..security import create_access_token, get_password_hash, require_driver, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def normalize_iraqi_phone(value: str) -> str:
    value = value.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    value = re.sub(r"[\s()\-]", "", value)
    value = re.sub(r"^00964", "+964", value)
    value = re.sub(r"^0(?=7)", "+964", value)
    if not re.fullmatch(r"\+9647\d{9}", value):
        raise ValueError("Enter a valid Iraqi mobile number")
    return value


class DriverApplication(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    phone: str
    password: str = Field(min_length=12, max_length=72)
    vehicle_type: str = Field(min_length=2, max_length=50)
    vehicle_model: str = Field(min_length=2, max_length=100)
    plate_number: str = Field(min_length=2, max_length=50)
    license_number: str = Field(min_length=2, max_length=100)
    national_id: str = Field(min_length=2, max_length=100)

    @field_validator("full_name", "vehicle_type", "vehicle_model", "plate_number", "license_number", "national_id")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("This field must contain at least two characters")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        return normalize_iraqi_phone(value)


@router.post("/driver-applications", status_code=201)
def submit_driver_application(application: DriverApplication, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.email == application.email)).first():
        raise HTTPException(409, "An account with this email already exists")
    duplicate_fields = (
        (Driver_Profile.phone_number, application.phone, "mobile number"),
        (Driver_Profile.license_number, application.license_number, "license number"),
        (Driver_Profile.national_id, application.national_id, "national ID"),
    )
    for column, value, label in duplicate_fields:
        if session.exec(select(Driver_Profile).where(column == value)).first():
            raise HTTPException(409, f"An application with this {label} already exists")

    user = User(
        name=application.full_name, email=application.email,
        password_hash=get_password_hash(application.password),
        role=UserRole.DRIVER, status=Status.PENDING,
    )
    try:
        session.add(user)
        session.flush()
        profile = Driver_Profile(
            Driver_id=user.id, phone_number=application.phone,
            vehicle_name=application.vehicle_type, vehicle_model=application.vehicle_model,
            vehicle_plate=application.plate_number, license_number=application.license_number,
            national_id=application.national_id, vehicle_photo_url="", license_photo_url="", id_photo_url="",
            verification_status=ApplicationStatus.PENDING,
        )
        session.add(profile)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "An application with these details already exists") from None
    session.refresh(profile)
    return {"application_id": profile.id, "status": "pending"}


@router.post("/driver-login")
def driver_login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    identifier = form_data.username.strip().lower()
    user = session.exec(select(User).where(User.email == identifier)).first()
    if not user:
        try:
            phone = normalize_iraqi_phone(identifier)
        except ValueError:
            phone = identifier
        profile = session.exec(select(Driver_Profile).where(Driver_Profile.phone_number == phone)).first()
        user = session.get(User, profile.Driver_id) if profile else None
    if not user or user.role != UserRole.DRIVER or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email, mobile number or password")
    profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == user.id)).first()
    if not profile:
        raise HTTPException(status_code=403, detail="Driver application not found")
    if profile.verification_status == ApplicationStatus.PENDING:
        raise HTTPException(status_code=403, detail="Your driver application is pending admin review")
    if profile.verification_status == ApplicationStatus.REJECTED:
        reason = profile.rejection_reason or "No reason was provided"
        raise HTTPException(status_code=403, detail=f"Your driver application was rejected. Reason: {reason}")
    if user.status != Status.ACTIVE:
        raise HTTPException(status_code=403, detail="Your driver account is not active")
    token = create_access_token({
        "sub": str(user.id), "role": user.role.value,
        "pwd": hashlib.sha256(user.password_hash.encode()).hexdigest(),
    })
    return {"access_token": token, "token_type": "bearer", "name": user.name}


@router.get("/driver-me")
def driver_me(user: User = Depends(require_driver), session: Session = Depends(get_session)):
    profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == user.id)).first()
    if not profile or profile.verification_status != ApplicationStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Driver approval is required")
    return {"name": user.name, "email": user.email, "status": "approved"}


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
