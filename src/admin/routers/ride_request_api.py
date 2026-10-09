from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import (ApplicationStatus, Driver_Profile, RideRequest, RideRequestStatus,
                      Route, RouteStatus, RouteStudents, RouteStudentStatus, Status, User, UserRole)
from ..security import require_driver, require_student
from .journey_api import approved_driver, discoverable, occupancy

student_router = APIRouter(prefix="/student/ride-requests", tags=["Student Ride Requests"])
driver_router = APIRouter(prefix="/driver/ride-requests", tags=["Driver Ride Requests"])
enrollment_router = APIRouter(prefix="/driver/routes", tags=["Driver Enrollments"])


class RequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    route_id: int = Field(gt=0)


class RequestResponse(BaseModel):
    id: int
    route_id: int
    status: RideRequestStatus
    created_at: datetime
    decided_at: datetime | None


class DriverRequestResponse(RequestResponse):
    student_id: int
    student_name: str


def locked_route(session: Session, route_id: int) -> Route:
    route = session.exec(select(Route).where(Route.id == route_id).with_for_update()).first()
    if route is None:
        raise HTTPException(404, "Route not found")
    return route


def active_enrollment(session: Session, student_id: int, route_id: int) -> bool:
    return session.exec(select(RouteStudents.id).where(
        RouteStudents.student_id == student_id,
        RouteStudents.route_id == route_id,
        RouteStudents.status == RouteStudentStatus.ACTIVE,
    )).first() is not None


def driver_request_response(request: RideRequest, session: Session) -> DriverRequestResponse:
    student = session.get(User, request.student_id)
    return DriverRequestResponse(id=request.id, route_id=request.route_id,
                                 status=request.status, created_at=request.created_at,
                                 decided_at=request.decided_at, student_id=request.student_id,
                                 student_name=student.name)


def driver_request(session: Session, request_id: int, driver: User,
                   *, lock_route: bool = False) -> tuple[RideRequest, Route]:
    request = session.get(RideRequest, request_id)
    if request is None:
        raise HTTPException(404, "Ride request not found")
    route = session.get(Route, request.route_id)
    if route is None or route.driver_id != driver.id:
        raise HTTPException(404, "Ride request not found")
    if lock_route:
        route = locked_route(session, request.route_id)
        if route.driver_id != driver.id:
            raise HTTPException(404, "Ride request not found")
        # Reload after acquiring the route lock; another decision may have committed.
        session.refresh(request)
    return request, route


def locked_driver_eligibility(session: Session, driver: User) -> None:
    # Serialize acceptance with Admin suspension and approval changes.
    profile = session.exec(select(Driver_Profile).where(
        Driver_Profile.Driver_id == driver.id
    ).with_for_update()).first()
    session.refresh(driver, with_for_update=True)
    if (driver.role != UserRole.DRIVER or driver.status != Status.ACTIVE or profile is None or
            profile.verification_status != ApplicationStatus.APPROVED):
        raise HTTPException(403, "An approved active driver is required")


@student_router.post("", status_code=201, response_model=RequestResponse)
def create_request(data: RequestCreate, student: User = Depends(require_student),
                   session: Session = Depends(get_session)):
    try:
        route = locked_route(session, data.route_id)
        route_driver = session.get(User, route.driver_id)
        if route_driver is None:
            raise HTTPException(409, "Route is not accepting requests")
        try:
            locked_driver_eligibility(session, route_driver)
        except HTTPException:
            raise HTTPException(409, "Route is not accepting requests") from None
        if route.status != RouteStatus.ACTIVE or not discoverable(route, session):
            raise HTTPException(409, "Route is not accepting requests")
        if occupancy(session, route.id) >= route.capacity:
            raise HTTPException(409, "No seats are available")
        if active_enrollment(session, student.id, route.id):
            raise HTTPException(409, "Student is already enrolled in this route")
        pending = session.exec(select(RideRequest.id).where(
            RideRequest.student_id == student.id, RideRequest.route_id == route.id,
            RideRequest.status == RideRequestStatus.PENDING,
        )).first()
        if pending is not None:
            raise HTTPException(409, "A pending request already exists for this route")
        request = RideRequest(student_id=student.id, route_id=route.id)
        session.add(request)
        session.commit()
        session.refresh(request)
        return request
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "A pending request already exists for this route") from None
    except Exception:
        session.rollback()
        raise


@student_router.get("", response_model=list[RequestResponse])
def own_requests(student: User = Depends(require_student), session: Session = Depends(get_session)):
    return session.exec(select(RideRequest).where(RideRequest.student_id == student.id)
                        .order_by(RideRequest.id.desc())).all()


@student_router.get("/{request_id}", response_model=RequestResponse)
def own_request(request_id: int, student: User = Depends(require_student),
                session: Session = Depends(get_session)):
    request = session.get(RideRequest, request_id)
    if request is None or request.student_id != student.id:
        raise HTTPException(404, "Ride request not found")
    return request


@driver_router.get("", response_model=list[DriverRequestResponse])
def incoming_requests(route_id: int | None = None, status: RideRequestStatus | None = None,
                      driver: User = Depends(require_driver), session: Session = Depends(get_session)):
    approved_driver(driver, session)
    query = select(RideRequest).join(Route, RideRequest.route_id == Route.id).where(Route.driver_id == driver.id)
    if route_id is not None:
        query = query.where(Route.id == route_id)
    if status is not None:
        query = query.where(RideRequest.status == status)
    return [driver_request_response(item, session) for item in session.exec(query.order_by(RideRequest.id.desc())).all()]


@driver_router.get("/{request_id}", response_model=DriverRequestResponse)
def incoming_request(request_id: int, driver: User = Depends(require_driver),
                     session: Session = Depends(get_session)):
    approved_driver(driver, session)
    request, _ = driver_request(session, request_id, driver)
    return driver_request_response(request, session)


@driver_router.post("/{request_id}/accept", response_model=DriverRequestResponse)
def accept_request(request_id: int, driver: User = Depends(require_driver),
                   session: Session = Depends(get_session)):
    try:
        request, route = driver_request(session, request_id, driver, lock_route=True)
        locked_driver_eligibility(session, driver)
        if request.status != RideRequestStatus.PENDING:
            raise HTTPException(409, "Ride request is no longer pending")
        if route.status != RouteStatus.ACTIVE or not discoverable(route, session):
            raise HTTPException(409, "Route is not accepting requests")
        if active_enrollment(session, request.student_id, route.id):
            raise HTTPException(409, "Student is already enrolled in this route")
        if occupancy(session, route.id) >= route.capacity:
            raise HTTPException(409, "No seats are available")
        request.status = RideRequestStatus.ACCEPTED
        request.decided_at = datetime.now(timezone.utc)
        request.decided_by = driver.id
        request.version += 1
        session.add(request)
        session.add(RouteStudents(student_id=request.student_id, route_id=route.id,
                                  status=RouteStudentStatus.ACTIVE))
        session.commit()
        session.refresh(request)
        return driver_request_response(request, session)
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Seat enrollment conflicts with an existing record") from None
    except Exception:
        session.rollback()
        raise


@driver_router.post("/{request_id}/decline", response_model=DriverRequestResponse)
def decline_request(request_id: int, driver: User = Depends(require_driver),
                    session: Session = Depends(get_session)):
    try:
        request, _ = driver_request(session, request_id, driver, lock_route=True)
        locked_driver_eligibility(session, driver)
        if request.status != RideRequestStatus.PENDING:
            raise HTTPException(409, "Ride request is no longer pending")
        request.status = RideRequestStatus.DECLINED
        request.decided_at = datetime.now(timezone.utc)
        request.decided_by = driver.id
        request.version += 1
        session.add(request)
        session.commit()
        session.refresh(request)
        return driver_request_response(request, session)
    except Exception:
        session.rollback()
        raise


@enrollment_router.get("/{route_id}/enrollments")
def route_enrollments(route_id: int, driver: User = Depends(require_driver),
                      session: Session = Depends(get_session)):
    approved_driver(driver, session)
    route = session.get(Route, route_id)
    if route is None or route.driver_id != driver.id:
        raise HTTPException(404, "Route not found")
    rows = session.exec(select(RouteStudents, User).join(User, RouteStudents.student_id == User.id).where(
        RouteStudents.route_id == route.id, RouteStudents.status == RouteStudentStatus.ACTIVE
    ).order_by(RouteStudents.id)).all()
    return {"route_id": route.id, "capacity": route.capacity,
            "occupied_seats": len(rows), "available_seats": max(0, route.capacity - len(rows)),
            "students": [{"student_id": user.id, "student_name": user.name,
                          "enrolled_at": entry.joined_at} for entry, user in rows]}
