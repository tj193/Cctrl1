from collections import defaultdict
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import (
    ApplicationStatus, Area, Driver_Profile, Report, ReportStatus, Route,
    RouteDemand, RouteDemandStatus, RouteStatus, RouteStudents,
    RouteStudentStatus, Status, University, User, UserRole,
)
from ..security import get_password_hash, require_admin, verify_password

router = APIRouter(prefix="/admin", tags=["Admin dashboard"], dependencies=[Depends(require_admin)])


def records(session: Session):
    return {
        "users": {item.id: item for item in session.exec(select(User)).all()},
        "areas": {item.id: item for item in session.exec(select(Area)).all()},
        "universities": {item.id: item for item in session.exec(select(University)).all()},
        "profiles": session.exec(select(Driver_Profile)).all(),
        "routes": session.exec(select(Route)).all(),
        "enrollments": session.exec(select(RouteStudents)).all(),
        "demands": session.exec(select(RouteDemand)).all(),
        "reports": session.exec(select(Report)).all(),
    }


def label(item, attribute, fallback="N/A"):
    return getattr(item, attribute, fallback) if item is not None else fallback


def iso(value):
    return value.isoformat() if value else None


def driver_application(profile, data):
    user = data["users"].get(profile.Driver_id)
    return {
        "id": profile.id,
        "applicant_name": label(user, "name"),
        "full_name": label(user, "name"),
        "phone": profile.phone_number,
        "vehicle_type": profile.vehicle_name,
        "vehicle_model": profile.vehicle_model,
        "vehicle_year": None,
        "plate_number": profile.vehicle_plate,
        "capacity": None,
        "license_url": profile.license_photo_url,
        "id_card_url": profile.id_photo_url,
        "submission_date": iso(label(user, "created_at", None)),
        "status": profile.verification_status.value,
    }


def report_row(report, data):
    reporter = data["users"].get(report.report_id)
    target = data["users"].get(report.target_id)
    return {
        "id": report.id,
        "reporter_name": label(reporter, "name"),
        "reporter_role": label(reporter, "role", "User").value if reporter else "User",
        "reported_target_name": label(target, "name"),
        "subject": report.reason,
        "description": report.reason,
        "created_at": iso(report.created_at),
        "status": report.status.value,
    }


def route_row(route, data):
    enrolled = sum(1 for item in data["enrollments"] if item.route_id == route.id and item.status == RouteStudentStatus.ACTIVE)
    return {
        "id": route.id,
        "driver_name": label(data["users"].get(route.driver_id), "name"),
        "origin_area": label(data["areas"].get(route.from_area_id), "Area_name"),
        "destination_area": None,
        "university_name": label(data["universities"].get(route.to_university_id), "University_name"),
        "enrolled_students": enrolled,
        "max_capacity": route.capacity,
        "status": route.status.value,
    }


@router.get("/dashboard/metrics")
def metrics(session: Session = Depends(get_session)):
    data = records(session)
    return {
        "total_students": sum(user.role == UserRole.STUDENT and user.status == Status.ACTIVE for user in data["users"].values()),
        "total_drivers": sum(user.role == UserRole.DRIVER and user.status == Status.ACTIVE for user in data["users"].values()),
        "pending_drivers": sum(profile.verification_status == ApplicationStatus.PENDING for profile in data["profiles"]),
        "active_routes": sum(route.status == RouteStatus.ACTIVE for route in data["routes"]),
        "open_reports": sum(report.status in (ReportStatus.PENDING, ReportStatus.INVESTIGATING) for report in data["reports"]),
    }


@router.get("/dashboard/recent-approvals")
def recent_approvals(session: Session = Depends(get_session)):
    data = records(session)
    pending = [profile for profile in data["profiles"] if profile.verification_status == ApplicationStatus.PENDING]
    return [driver_application(profile, data) for profile in sorted(pending, key=lambda item: item.id, reverse=True)[:5]]


@router.get("/dashboard/recent-reports")
def recent_reports(session: Session = Depends(get_session)):
    data = records(session)
    open_reports = [report for report in data["reports"] if report.status in (ReportStatus.PENDING, ReportStatus.INVESTIGATING)]
    return [report_row(report, data) for report in sorted(open_reports, key=lambda item: item.created_at, reverse=True)[:5]]


@router.get("/driver-applications")
def driver_applications(session: Session = Depends(get_session)):
    data = records(session)
    return [driver_application(profile, data) for profile in data["profiles"]]


class ApplicationUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    notes: str = ""


@router.patch("/driver-applications/{profile_id}/status")
def review_application(profile_id: int, update: ApplicationUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    profile = session.get(Driver_Profile, profile_id)
    if not profile:
        raise HTTPException(404, "Driver application not found")
    if update.status == "rejected" and not update.notes.strip():
        raise HTTPException(400, "Rejection reason is required")
    profile.verification_status = ApplicationStatus(update.status.capitalize())
    profile.rejection_reason = update.notes.strip() if update.status == "rejected" else None
    profile.reviewed_by = admin.id
    profile.reviewed_at = datetime.now(timezone.utc)
    user = session.get(User, profile.Driver_id)
    if user:
        user.status = Status.ACTIVE if update.status == "approved" else Status.SUSPENDED
        session.add(user)
    session.add(profile)
    session.commit()
    return {"status": profile.verification_status.value}


@router.get("/route-demand")
def route_demand(session: Session = Depends(get_session)):
    data = records(session)
    groups = defaultdict(list)
    for demand in data["demands"]:
        if demand.status == RouteDemandStatus.ACTIVE:
            groups[(demand.from_area_id, demand.to_university_id)].append(demand)
    active_routes = {(route.from_area_id, route.to_university_id) for route in data["routes"] if route.status == RouteStatus.ACTIVE}
    return [
        {
            "id": min(item.id for item in group),
            "area_id": area_id,
            "university_id": university_id,
            "area_name": label(data["areas"].get(area_id), "Area_name"),
            "university_name": label(data["universities"].get(university_id), "University_name"),
            "student_count": len(group),
            "route_exists": (area_id, university_id) in active_routes,
            "status": "Active",
        }
        for (area_id, university_id), group in groups.items()
    ]


@router.get("/available-drivers")
def available_drivers(session: Session = Depends(get_session)):
    data = records(session)
    return [
        {"id": user.id, "name": user.name, "capacity": None}
        for profile in data["profiles"]
        if (user := data["users"].get(profile.Driver_id)) is not None
        and user.role == UserRole.DRIVER and user.status == Status.ACTIVE
        and profile.verification_status == ApplicationStatus.APPROVED
    ]


class RouteCreate(BaseModel):
    area_id: int
    university_id: int
    driver_id: int
    capacity: int = Field(gt=0)


@router.post("/routes", status_code=201)
def create_route(data: RouteCreate, session: Session = Depends(get_session)):
    driver = session.get(User, data.driver_id)
    if not driver or driver.role != UserRole.DRIVER or driver.status != Status.ACTIVE:
        raise HTTPException(400, "An active driver is required")
    profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == driver.id)).first()
    if not profile or profile.verification_status != ApplicationStatus.APPROVED:
        raise HTTPException(400, "An approved driver is required")
    if not session.get(Area, data.area_id) or not session.get(University, data.university_id):
        raise HTTPException(400, "Area or university not found")
    route = Route(driver_id=driver.id, from_area_id=data.area_id, to_university_id=data.university_id, capacity=data.capacity)
    session.add(route)
    session.commit()
    session.refresh(route)
    return {"id": route.id}


@router.get("/routes")
def routes(session: Session = Depends(get_session)):
    data = records(session)
    return [route_row(route, data) for route in data["routes"]]


class RouteUpdate(BaseModel):
    status: Literal["active", "disabled"]
    notes: str = ""


@router.patch("/routes/{route_id}/status")
def route_status(route_id: int, update: RouteUpdate, session: Session = Depends(get_session)):
    route = session.get(Route, route_id)
    if not route:
        raise HTTPException(404, "Route not found")
    route.status = RouteStatus(update.status.capitalize())
    session.add(route)
    session.commit()
    return {"status": route.status.value}


@router.get("/drivers")
def drivers(session: Session = Depends(get_session)):
    data = records(session)
    assigned = {route.driver_id: route.id for route in data["routes"] if route.status == RouteStatus.ACTIVE}
    return [
        {
            "id": user.id,
            "full_name": user.name,
            "phone": profile.phone_number,
            "vehicle_type": profile.vehicle_name,
            "plate_number": profile.vehicle_plate,
            "assigned_route": f"Route #{assigned[user.id]}" if user.id in assigned else None,
            "rating": None,
            "status": user.status.value,
        }
        for profile in data["profiles"]
        if (user := data["users"].get(profile.Driver_id)) is not None and user.role == UserRole.DRIVER
    ]


class UserStatusUpdate(BaseModel):
    status: Literal["active", "suspended"]
    notes: str = ""


def update_user_status(user_id: int, role: UserRole, update: UserStatusUpdate, session: Session):
    user = session.get(User, user_id)
    if not user or user.role != role:
        raise HTTPException(404, "Account not found")
    user.status = Status(update.status.capitalize())
    session.add(user)
    session.commit()
    return {"status": user.status.value}


@router.patch("/drivers/{user_id}/status")
def driver_status(user_id: int, update: UserStatusUpdate, session: Session = Depends(get_session)):
    return update_user_status(user_id, UserRole.DRIVER, update, session)


@router.get("/reports")
def reports(session: Session = Depends(get_session)):
    data = records(session)
    return [report_row(report, data) for report in data["reports"]]


class ReportUpdate(BaseModel):
    status: Literal["resolved", "dismissed"]
    notes: str = ""


@router.patch("/reports/{report_id}/status")
def report_status(report_id: int, update: ReportUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = ReportStatus(update.status.capitalize())
    report.resolved_by = admin.id
    session.add(report)
    session.commit()
    return {"status": report.status.value}


@router.get("/students")
def students(session: Session = Depends(get_session)):
    data = records(session)
    active_enrollments = {item.student_id: item for item in data["enrollments"] if item.status == RouteStudentStatus.ACTIVE}
    routes_by_id = {item.id: item for item in data["routes"]}
    latest_demands = {item.student_id: item for item in data["demands"]}
    result = []
    for user in data["users"].values():
        if user.role != UserRole.STUDENT:
            continue
        enrollment = active_enrollments.get(user.id)
        route = routes_by_id.get(enrollment.route_id) if enrollment else None
        demand = latest_demands.get(user.id)
        area_id = route.from_area_id if route else demand.from_area_id if demand else None
        university_id = route.to_university_id if route else demand.to_university_id if demand else None
        result.append({
            "id": user.id,
            "full_name": user.name,
            "phone": None,
            "university_name": label(data["universities"].get(university_id), "University_name"),
            "area_name": label(data["areas"].get(area_id), "Area_name"),
            "current_route": f"Route #{route.id}" if route else None,
            "account_status": user.status.value,
        })
    return result


@router.patch("/students/{user_id}/status")
def student_status(user_id: int, update: UserStatusUpdate, session: Session = Depends(get_session)):
    return update_user_status(user_id, UserRole.STUDENT, update, session)


@router.get("/universities")
def universities(session: Session = Depends(get_session)):
    return [{"id": item.id, "name": item.University_name, "status": item.status.value} for item in session.exec(select(University)).all()]


@router.get("/areas")
def areas(session: Session = Depends(get_session)):
    return [{"id": item.id, "name": item.Area_name, "city": item.city, "status": item.status.value} for item in session.exec(select(Area)).all()]


@router.get("/me")
def me(admin: User = Depends(require_admin)):
    return {"name": admin.name, "email": admin.email}


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)


@router.put("/me")
def update_profile(update: ProfileUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    email = update.email.strip().lower()
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing and existing.id != admin.id:
        raise HTTPException(409, "Email is already in use")
    admin.name = update.name.strip()
    admin.email = email
    session.add(admin)
    session.commit()
    return {"name": admin.name, "email": admin.email}


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=12)


@router.post("/me/password")
def update_password(update: PasswordUpdate, session: Session = Depends(get_session), admin: User = Depends(require_admin)):
    if not verify_password(update.current_password, admin.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    admin.password_hash = get_password_hash(update.new_password)
    session.add(admin)
    session.commit()
    return {"message": "Password updated"}
