import hashlib
import re

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import ApplicationStatus, Driver_Profile, Status, User, UserRole
from ..security import create_access_token, get_password_hash, require_driver, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def normalize_iraqi_phone(value: str) -> str:
    value = value.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    value = re.sub(r"[\s()-]", "", value)
    value = re.sub(r"^00964", "+964", value)
    value = re.sub(r"^0(?=7)", "+964", value)
    if not re.fullmatch(r"\+9647\d{9}", value):
        raise ValueError("Enter a valid Iraqi mobile number")
    return value


class DriverRegistration(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    phone: str
    password: str = Field(min_length=12, max_length=72)
    vehicle_type: str = Field(min_length=2, max_length=80)
    vehicle_model: str = Field(min_length=2, max_length=120)
    plate_number: str = Field(min_length=2, max_length=40)
    license_number: str = Field(min_length=2, max_length=80)
    national_id: str = Field(min_length=2, max_length=80)

    @field_validator("full_name", "vehicle_type", "vehicle_model", "plate_number", "license_number", "national_id")
    @classmethod
    def clean_required(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("This field must contain at least two characters")
        return value

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str) -> str:
        return normalize_iraqi_phone(value)


@router.post("/driver-register", status_code=201)
@router.post("/driver-applications", status_code=201)
def register_driver(data: DriverRegistration, session: Session = Depends(get_session)):
    email = data.email
    phone = data.phone
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(409, "An account with this email already exists")
    for field, value in ((Driver_Profile.phone_number, phone), (Driver_Profile.vehicle_plate, data.plate_number.strip()),
                         (Driver_Profile.license_number, data.license_number.strip()), (Driver_Profile.national_id, data.national_id.strip())):
        if session.exec(select(Driver_Profile).where(field == value)).first():
            raise HTTPException(409, "An application with these details already exists")
    user = User(name=data.full_name.strip(), email=email, password_hash=get_password_hash(data.password),
                role=UserRole.DRIVER, status=Status.PENDING)
    try:
        session.add(user)
        session.flush()
        profile = Driver_Profile(Driver_id=user.id, phone_number=phone, vehicle_name=data.vehicle_type.strip(),
                                 vehicle_model=data.vehicle_model.strip(), vehicle_plate=data.plate_number.strip(),
                                 license_number=data.license_number.strip(), national_id=data.national_id.strip(),
                                 vehicle_photo_url="", license_photo_url="", id_photo_url="",
                                 verification_status=ApplicationStatus.PENDING)
        session.add(profile)
        session.commit()
        session.refresh(profile)
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "An application with these details already exists") from None
    return {"application_id": profile.id, "status": "Pending"}


@router.post("/driver-login")
def driver_login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    identifier = form_data.username.strip().lower()
    user = session.exec(select(User).where(User.email == identifier)).first()
    if not user:
        try:
            phone = normalize_iraqi_phone(identifier)
        except ValueError:
            phone = identifier
        found = session.exec(select(Driver_Profile).where(Driver_Profile.phone_number == phone)).first()
        user = session.get(User, found.Driver_id) if found else None
    if not user or user.role != UserRole.DRIVER or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(401, "Email, mobile number or password is incorrect")
    profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == user.id)).first()
    if not profile:
        raise HTTPException(403, "Driver application not found")
    if profile.verification_status == ApplicationStatus.PENDING:
        raise HTTPException(403, "Your driver application is still pending review")
    if profile.verification_status == ApplicationStatus.REJECTED:
        raise HTTPException(403, f"Your driver application was rejected. Reason: {profile.rejection_reason or 'No reason was provided'}")
    if profile.verification_status != ApplicationStatus.APPROVED or user.status != Status.ACTIVE:
        raise HTTPException(403, "Your driver application has not been approved")
    token = create_access_token({"sub": str(user.id), "role": user.role.value,
                                 "pwd": hashlib.sha256(user.password_hash.encode()).hexdigest()})
    return {"access_token": token, "token_type": "bearer", "name": user.name}


@router.get("/driver-me")
def driver_me(user: User = Depends(require_driver), session: Session = Depends(get_session)):
    profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == user.id)).first()
    if not profile or profile.verification_status != ApplicationStatus.APPROVED:
        raise HTTPException(403, "Driver approval is required")
    return {"name": user.name, "email": user.email, "status": "approved"}


@router.post("/student-login")
def student_login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    email = form_data.username.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or user.role != UserRole.STUDENT or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect")
    if user.status != Status.ACTIVE:
        raise HTTPException(403, "Student account is not active")
    return {"name": user.name, "email": user.email, "role": "student"}


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
