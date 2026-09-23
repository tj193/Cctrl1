from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import Driver_Profile, ApplicationStatus

router = APIRouter(prefix="/drivers", tags=["Driver Management"])

@router.get("/", response_model=List[Driver_Profile])
def get_drivers(status: Optional[ApplicationStatus] = None , session: Session = Depends(get_session)):

    query = select(Driver_Profile)
    if status:
        query = query.where(Driver_Profile.verification_status == status)
    
    drivers = session.exec(query).all()
    return drivers

@router.get("/{driver_id}", response_model=Driver_Profile)

def get_driver_details(driver_id: int, session: Session = Depends(get_session)):
    driver = session.get(Driver_Profile, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return driver

@router.patch("/{driver_id}/review", response_model=Driver_Profile)

def review_driver(driver_id: int , action: ApplicationStatus , admin_id: int , rejection_reason: Optional[str] = None , session: Session = Depends(get_session)):

    driver = session.get(Driver_Profile, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    if action == ApplicationStatus.REJECTED and not rejection_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required when rejecting a driver"
        )

    driver.verification_status = action
    driver.reviewed_by = admin_id
    if rejection_reason:
        driver.rejection_reason = rejection_reason

    session.add(driver)
    session.commit()
    session.refresh(driver)
    return driver