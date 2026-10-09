from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import Report, ReportStatus, User
from ..security import require_admin
from .report_api import ReportReview, apply_review

router = APIRouter(prefix="/reports", tags=["Report Management"])

@router.get("/", response_model=List[Report])
def get_reports(status: Optional[ReportStatus] = None , session: Session = Depends(get_session)):

    query = select(Report)
    if status:
        query = query.where(Report.status == status)
    
    reports = session.exec(query).all()
    return reports

@router.get("/{report_id}", response_model=Report)

def get_report_details(report_id: int, session: Session = Depends(get_session)):

    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@router.patch("/{report_id}/status", response_model=Report)

def update_report_status(report_id: int , new_status: ReportStatus , session: Session = Depends(get_session),
                         admin: User = Depends(require_admin)):

    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    apply_review(report, ReportReview(status=new_status), admin, session)
    session.refresh(report)
    return report
