"""Public, read-only catalogue choices for registration before authentication."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import Area, University, UniversityStatus

router = APIRouter(prefix="/public/catalogue", tags=["Public Catalogue"])


@router.get("/areas")
def areas(session: Session = Depends(get_session)):
    rows = session.exec(select(Area).where(Area.status == UniversityStatus.ACTIVE)
                        .order_by(Area.city, Area.Area_name)).all()
    return [{"id": row.id, "name": row.Area_name, "governorate": row.city} for row in rows]


@router.get("/universities")
def universities(session: Session = Depends(get_session)):
    rows = session.exec(select(University).where(University.status == UniversityStatus.ACTIVE)
                        .order_by(University.University_name)).all()
    return [{"id": row.id, "name": row.University_name,
             "governorate": row.governorate} for row in rows]
