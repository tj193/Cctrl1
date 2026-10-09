from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlmodel import Session, select

from ..DataBase import get_session
from ..catalog import active_area, active_university
from ..models import Area, StudentProfile, University, UniversityStatus, User
from ..security import require_student
from .Authentications import normalize_iraqi_phone

router = APIRouter(prefix="/student", tags=["Student"])


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: str | None = None
    area_id: int | None = Field(default=None, gt=0)
    university_id: int | None = Field(default=None, gt=0)
    preferred_arrival_time: time | None = None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str | None) -> str | None:
        return normalize_iraqi_phone(value) if value is not None else None


class ProfileResponse(BaseModel):
    user_id: int
    name: str
    email: str
    phone: str | None
    area_id: int | None
    university_id: int | None
    preferred_arrival_time: time | None


def profile_response(user: User, profile: StudentProfile) -> ProfileResponse:
    return ProfileResponse(user_id=user.id, name=user.name, email=user.email,
                           phone=profile.phone, area_id=profile.area_id,
                           university_id=profile.university_id,
                           preferred_arrival_time=profile.preferred_arrival_time)


@router.get("/profile", response_model=ProfileResponse)
def get_profile(user: User = Depends(require_student), session: Session = Depends(get_session)):
    profile = session.get(StudentProfile, user.id)
    if profile is None:
        raise HTTPException(404, "Student profile not found")
    return profile_response(user, profile)


@router.put("/profile", response_model=ProfileResponse)
def put_profile(data: ProfileUpdate, user: User = Depends(require_student),
                session: Session = Depends(get_session)):
    profile = session.get(StudentProfile, user.id) or StudentProfile(user_id=user.id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("area_id") is not None:
        active_area(session, changes["area_id"])
    if changes.get("university_id") is not None:
        active_university(session, changes["university_id"])
    for field, value in changes.items():
        setattr(profile, field, value)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile_response(user, profile)


@router.get("/areas")
def list_areas(user: User = Depends(require_student), session: Session = Depends(get_session)):
    areas = session.exec(select(Area).where(Area.status == UniversityStatus.ACTIVE)).all()
    return [{"id": area.id, "name": area.Area_name, "city": area.city} for area in areas]


@router.get("/universities")
def list_universities(user: User = Depends(require_student), session: Session = Depends(get_session)):
    universities = session.exec(select(University).where(University.status == UniversityStatus.ACTIVE)).all()
    return [{"id": item.id, "name": item.University_name, "governorate": item.governorate}
            for item in universities]
