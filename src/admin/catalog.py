from fastapi import HTTPException
from sqlmodel import Session

from .models import Area, University, UniversityStatus


def active_area(session: Session, area_id: int) -> Area:
    area = session.get(Area, area_id)
    if area is None or area.status != UniversityStatus.ACTIVE:
        raise HTTPException(422, "An active area ID is required")
    return area


def active_university(session: Session, university_id: int) -> University:
    university = session.get(University, university_id)
    if university is None or university.status != UniversityStatus.ACTIVE:
        raise HTTPException(422, "An active university ID is required")
    return university
