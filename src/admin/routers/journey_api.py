from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlmodel import Session, select

from ..DataBase import get_session
from ..catalog import active_area, active_university
from ..models import (ApplicationStatus, Area, Driver_Profile, Route, RouteStatus,
                      RouteStudents, RouteStudentStatus, Status, University, UniversityStatus, User, UserRole)
from ..security import require_driver, require_student

driver_router = APIRouter(prefix="/driver/routes", tags=["Driver Routes"])
student_router = APIRouter(prefix="/student/routes", tags=["Student Routes"])


class RouteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    from_area_id: int = Field(gt=0)
    to_university_id: int = Field(gt=0)
    capacity: int = Field(gt=0)
    departure_time: time
    return_time: time
    price_iqd: int = Field(ge=0)
    notes: str | None = Field(default=None, max_length=500)


class RouteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    from_area_id: int | None = Field(default=None, gt=0)
    to_university_id: int | None = Field(default=None, gt=0)
    capacity: int | None = Field(default=None, gt=0)
    departure_time: time | None = None
    return_time: time | None = None
    price_iqd: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=500)


class RouteResponse(BaseModel):
    id: int
    driver_name: str
    from_area_id: int
    origin_area: str
    to_university_id: int
    destination_university: str
    departure_time: time | None
    return_time: time | None
    price_iqd: int | None
    capacity: int
    occupied_seats: int
    available_seats: int
    status: RouteStatus


class DriverRouteResponse(RouteResponse):
    notes: str | None


def approved_driver(user: User, session: Session) -> None:
    profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == user.id)).first()
    if user.status != Status.ACTIVE or profile is None or profile.verification_status != ApplicationStatus.APPROVED:
        raise HTTPException(403, "An approved active driver is required")


def owned_route(route_id: int, user: User, session: Session, *, lock: bool = False) -> Route:
    route = (session.exec(select(Route).where(Route.id == route_id).with_for_update()).first()
             if lock else session.get(Route, route_id))
    if route is None or route.driver_id != user.id:
        raise HTTPException(404, "Route not found")
    return route


def occupancy(session: Session, route_id: int) -> int:
    return session.exec(select(func.count(RouteStudents.id)).where(
        RouteStudents.route_id == route_id, RouteStudents.status == RouteStudentStatus.ACTIVE
    )).one()


def route_response(route: Route, session: Session, *, occupied: int | None = None,
                   driver: User | None = None, area: Area | None = None,
                   university: University | None = None) -> DriverRouteResponse:
    occupied = occupancy(session, route.id) if occupied is None else occupied
    driver = driver or session.get(User, route.driver_id)
    area = area or session.get(Area, route.from_area_id)
    university = university or session.get(University, route.to_university_id)
    return DriverRouteResponse(id=route.id, driver_name=driver.name,
                         from_area_id=route.from_area_id, origin_area=area.Area_name,
                         to_university_id=route.to_university_id,
                         destination_university=university.University_name,
                         departure_time=route.departure_time, return_time=route.return_time,
                         price_iqd=route.price_iqd, capacity=route.capacity,
                         occupied_seats=occupied,
                         available_seats=max(0, route.capacity - occupied), status=route.status,
                         notes=route.notes)


@driver_router.post("", status_code=201, response_model=DriverRouteResponse)
def create_route(data: RouteCreate, user: User = Depends(require_driver),
                 session: Session = Depends(get_session)):
    approved_driver(user, session)
    active_area(session, data.from_area_id)
    active_university(session, data.to_university_id)
    route = Route(driver_id=user.id, **data.model_dump())
    session.add(route)
    session.commit()
    session.refresh(route)
    return route_response(route, session, occupied=0, driver=user)


@driver_router.get("", response_model=list[DriverRouteResponse])
def own_routes(user: User = Depends(require_driver), session: Session = Depends(get_session)):
    approved_driver(user, session)
    routes = session.exec(select(Route).where(Route.driver_id == user.id).order_by(Route.id.desc())).all()
    return [route_response(route, session, driver=user) for route in routes]


@driver_router.get("/{route_id}", response_model=DriverRouteResponse)
def own_route(route_id: int, user: User = Depends(require_driver),
              session: Session = Depends(get_session)):
    approved_driver(user, session)
    return route_response(owned_route(route_id, user, session), session, driver=user)


@driver_router.patch("/{route_id}", response_model=DriverRouteResponse)
def update_route(route_id: int, data: RouteUpdate, user: User = Depends(require_driver),
                 session: Session = Depends(get_session)):
    approved_driver(user, session)
    route = owned_route(route_id, user, session, lock=True)
    changes = data.model_dump(exclude_unset=True)
    for field in ("departure_time", "return_time", "price_iqd", "capacity", "from_area_id", "to_university_id"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be cleared")
    if "from_area_id" in changes:
        active_area(session, changes["from_area_id"])
    if "to_university_id" in changes:
        active_university(session, changes["to_university_id"])
    occupied = occupancy(session, route.id)
    if "capacity" in changes and changes["capacity"] < occupied:
        raise HTTPException(409, "Capacity cannot be lower than occupied seats")
    for field, value in changes.items():
        setattr(route, field, value)
    session.add(route)
    session.commit()
    session.refresh(route)
    return route_response(route, session, occupied=occupied, driver=user)


@driver_router.patch("/{route_id}/disable", response_model=DriverRouteResponse)
def disable_route(route_id: int, user: User = Depends(require_driver),
                  session: Session = Depends(get_session)):
    approved_driver(user, session)
    route = owned_route(route_id, user, session, lock=True)
    route.status = RouteStatus.DISABLED
    session.add(route)
    session.commit()
    session.refresh(route)
    return route_response(route, session, driver=user)


def discoverable(route: Route, session: Session) -> bool:
    area = session.get(Area, route.from_area_id)
    university = session.get(University, route.to_university_id)
    if area is None or area.status != UniversityStatus.ACTIVE or university is None or university.status != UniversityStatus.ACTIVE:
        return False
    driver = session.get(User, route.driver_id)
    if driver is None or driver.role != UserRole.DRIVER or driver.status != Status.ACTIVE:
        return False
    profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == driver.id)).first()
    return profile is not None and profile.verification_status == ApplicationStatus.APPROVED


@student_router.get("", response_model=list[RouteResponse])
def search_routes(from_area_id: int | None = None, to_university_id: int | None = None,
                  status: RouteStatus | None = None, user: User = Depends(require_student),
                  session: Session = Depends(get_session)):
    if from_area_id is not None:
        active_area(session, from_area_id)
    if to_university_id is not None:
        active_university(session, to_university_id)
    if status == RouteStatus.DISABLED:
        return []
    query = select(Route).where(Route.status.in_([RouteStatus.ACTIVE, RouteStatus.FULL]))
    if status is not None:
        query = query.where(Route.status == status)
    if from_area_id is not None:
        query = query.where(Route.from_area_id == from_area_id)
    if to_university_id is not None:
        query = query.where(Route.to_university_id == to_university_id)
    routes = session.exec(query.order_by(Route.id.desc())).all()
    return [route_response(route, session) for route in routes if discoverable(route, session)]


@student_router.get("/{route_id}", response_model=RouteResponse)
def student_route_detail(route_id: int, user: User = Depends(require_student),
                         session: Session = Depends(get_session)):
    route = session.get(Route, route_id)
    if route is None or route.status == RouteStatus.DISABLED or not discoverable(route, session):
        raise HTTPException(404, "Route not found")
    return route_response(route, session)
