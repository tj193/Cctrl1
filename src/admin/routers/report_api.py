from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import (Report, ReportStatus, RideRequest, Route, RouteStudents,
                      User, UserRole)
from ..security import require_driver, require_student
from .journey_api import approved_driver

student_router = APIRouter(prefix="/student/reports", tags=["Student Reports"])
driver_router = APIRouter(prefix="/driver/reports", tags=["Driver Reports"])

REPORT_TYPES = {"safety", "driver", "route", "service", "other", "student", "account"}


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str = Field(min_length=1, max_length=32)
    subject: str = Field(min_length=4, max_length=120)
    description: str = Field(min_length=15, max_length=4000)
    related_route_id: int | None = Field(default=None, gt=0)
    target_id: int | None = Field(default=None, gt=0)

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in REPORT_TYPES:
            raise ValueError("Unsupported report type")
        return value

    @field_validator("subject", "description")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Report content cannot be blank")
        return value


class OwnerReport(BaseModel):
    id: int
    type: str | None
    subject: str
    description: str | None
    legacy_fallback: bool
    target_id: int | None
    target_type: UserRole | None
    related_route_id: int | None
    status: ReportStatus
    public_resolution: str | None
    created_at: datetime
    updated_at: datetime | None
    resolved_at: datetime | None


def owner_report(report: Report) -> OwnerReport:
    legacy = report.subject is None or report.description is None
    return OwnerReport(
        id=report.id, type=report.type,
        subject=report.subject if report.subject is not None else f"Legacy report #{report.id}",
        description=report.description if report.description is not None else report.reason,
        legacy_fallback=legacy, target_id=report.target_id, target_type=report.target_type,
        related_route_id=report.related_route_id, status=report.status,
        public_resolution=report.public_resolution, created_at=report.created_at,
        updated_at=report.updated_at, resolved_at=report.resolved_at,
    )


def admin_report(report: Report) -> dict:
    return {**owner_report(report).model_dump(), "reporter_id": report.report_id,
            "reason": report.reason, "internal_notes": report.internal_notes,
            "resolved_by": report.resolved_by}


def ensure_canonical_report_schema(session: Session) -> None:
    reason = next((column for column in inspect(session.connection()).get_columns("report")
                   if column["name"] == "reason"), None)
    if reason is None or not reason["nullable"]:
        raise HTTPException(503, "Report creation requires the reviewed reason-nullable migration")


def validate_report_context(data: ReportCreate, owner: User, session: Session) -> User | None:
    route = session.get(Route, data.related_route_id) if data.related_route_id is not None else None
    if data.related_route_id is not None and route is None:
        raise HTTPException(422, "Related route not found")
    if route is not None:
        if owner.role == UserRole.DRIVER and route.driver_id != owner.id:
            raise HTTPException(404, "Related route not found")
        if owner.role == UserRole.STUDENT:
            has_request = session.exec(select(RideRequest.id).where(
                RideRequest.student_id == owner.id, RideRequest.route_id == route.id
            )).first() is not None
            has_enrollment = session.exec(select(RouteStudents.id).where(
                RouteStudents.student_id == owner.id, RouteStudents.route_id == route.id
            )).first() is not None
            if not has_request and not has_enrollment:
                raise HTTPException(404, "Related route not found")
    if data.target_id is None:
        return None
    if route is None:
        raise HTTPException(422, "A related route is required when reporting a user")
    target = session.get(User, data.target_id)
    expected_role = UserRole.DRIVER if owner.role == UserRole.STUDENT else UserRole.STUDENT
    if target is None or target.role != expected_role:
        raise HTTPException(422, "Invalid report target")
    if owner.role == UserRole.STUDENT and route.driver_id != target.id:
        raise HTTPException(422, "Target is not the route driver")
    if owner.role == UserRole.DRIVER:
        involved = session.exec(select(RouteStudents.id).where(
            RouteStudents.route_id == route.id, RouteStudents.student_id == target.id
        )).first() is not None or session.exec(select(RideRequest.id).where(
            RideRequest.route_id == route.id, RideRequest.student_id == target.id
        )).first() is not None
        if not involved:
            raise HTTPException(422, "Target is not associated with this route")
    return target


def create_report(data: ReportCreate, owner: User, session: Session) -> OwnerReport:
    ensure_canonical_report_schema(session)
    allowed_types = ({"safety", "driver", "route", "service", "other", "account"}
                     if owner.role == UserRole.STUDENT else
                     {"student", "route", "service", "account", "other"})
    if data.type not in allowed_types:
        raise HTTPException(422, "Report type is not permitted for this role")
    target = validate_report_context(data, owner, session)
    report = Report(report_id=owner.id, reason=None, type=data.type, subject=data.subject,
                    description=data.description, related_route_id=data.related_route_id,
                    target_id=target.id if target else None,
                    target_type=target.role if target else None)
    try:
        session.add(report)
        session.commit()
        session.refresh(report)
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Report references an unavailable record") from None
    return owner_report(report)


def own_report(report_id: int, owner: User, session: Session) -> OwnerReport:
    report = session.get(Report, report_id)
    if report is None or report.report_id != owner.id:
        raise HTTPException(404, "Report not found")
    return owner_report(report)


@student_router.post("", status_code=201, response_model=OwnerReport)
def student_create(data: ReportCreate, student: User = Depends(require_student),
                   session: Session = Depends(get_session)):
    return create_report(data, student, session)


@student_router.get("", response_model=list[OwnerReport])
def student_list(student: User = Depends(require_student), session: Session = Depends(get_session)):
    reports = session.exec(select(Report).where(Report.report_id == student.id)
                           .order_by(Report.id.desc())).all()
    return [owner_report(item) for item in reports]


@student_router.get("/{report_id}", response_model=OwnerReport)
def student_detail(report_id: int, student: User = Depends(require_student),
                   session: Session = Depends(get_session)):
    return own_report(report_id, student, session)


@driver_router.post("", status_code=201, response_model=OwnerReport)
def driver_create(data: ReportCreate, driver: User = Depends(require_driver),
                  session: Session = Depends(get_session)):
    approved_driver(driver, session)
    return create_report(data, driver, session)


@driver_router.get("", response_model=list[OwnerReport])
def driver_list(driver: User = Depends(require_driver), session: Session = Depends(get_session)):
    approved_driver(driver, session)
    reports = session.exec(select(Report).where(Report.report_id == driver.id)
                           .order_by(Report.id.desc())).all()
    return [owner_report(item) for item in reports]


@driver_router.get("/{report_id}", response_model=OwnerReport)
def driver_detail(report_id: int, driver: User = Depends(require_driver),
                  session: Session = Depends(get_session)):
    approved_driver(driver, session)
    return own_report(report_id, driver, session)


class ReportReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: ReportStatus | None = None
    public_resolution: str | None = Field(default=None, max_length=4000)
    internal_notes: str | None = Field(default=None, max_length=4000)


def apply_review(report: Report, review: ReportReview, admin: User, session: Session) -> None:
    if review.status is not None and review.status != report.status:
        allowed = {
            ReportStatus.PENDING: {ReportStatus.INVESTIGATING, ReportStatus.RESOLVED, ReportStatus.DISMISSED},
            ReportStatus.INVESTIGATING: {ReportStatus.RESOLVED, ReportStatus.DISMISSED},
        }
        if review.status not in allowed.get(report.status, set()):
            raise HTTPException(409, "Invalid report status transition")
        report.status = review.status
    if "public_resolution" in review.model_fields_set:
        report.public_resolution = review.public_resolution
    if "internal_notes" in review.model_fields_set:
        report.internal_notes = review.internal_notes
    now = datetime.now(timezone.utc)
    report.updated_at = now
    if report.status in (ReportStatus.RESOLVED, ReportStatus.DISMISSED):
        report.resolved_at = report.resolved_at or now
        report.resolved_by = admin.id
    session.add(report)
    session.commit()
