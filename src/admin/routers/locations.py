from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import Area, University, UniversityStatus

router = APIRouter(prefix="/locations", tags=["Universities & Areas"])

@router.post("/universities", response_model=University, status_code=status.HTTP_201_CREATED)

def create_university(university: University, session: Session = Depends(get_session)):

    existing = session.exec(
        select(University).where(University.University_name == university.University_name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="University name already exists"
        )
    
    session.add(university)
    session.commit()
    session.refresh(university)
    return university


@router.get("/universities", response_model=List[University])

def get_universities(session: Session = Depends(get_session)):

    universities = session.exec(select(University)).all()
    return universities


@router.patch("/universities/{university_id}/status", response_model=University)

def update_university_status(university_id: int, new_status: UniversityStatus, session: Session = Depends(get_session)):

    university = session.get(University, university_id)
    if not university:
        raise HTTPException(status_code=404, detail="University not found")
    
    university.status = new_status
    session.add(university)
    session.commit()
    session.refresh(university)
    return university

@router.post("/areas", response_model=Area, status_code=status.HTTP_201_CREATED)

def create_area(area: Area, session: Session = Depends(get_session)):

    existing = session.exec(
        select(Area).where(Area.Area_name == area.Area_name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Area name already exists"
        )
    
    session.add(area)
    session.commit()
    session.refresh(area)
    return area


@router.get("/areas", response_model=List[Area])

def get_areas(session: Session = Depends(get_session)):

    areas = session.exec(select(Area)).all()
    return areas