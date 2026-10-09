from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..DataBase import get_session
from ..catalog import active_area, active_university
from ..models import (RideRequest, RideRequestStatus, Route, RouteDemand,
                      RouteDemandStatus, RouteStatus, RouteStudents,
                      RouteStudentStatus, User)
from ..security import require_student
from .journey_api import discoverable, occupancy

router = APIRouter(prefix="/student/route-demand", tags=["Student Route Demand"])


class DemandCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    from_area_id: int = Field(gt=0)
    to_university_id: int = Field(gt=0)
    preferred_time: datetime | None = None

    @field_validator("preferred_time")
    @classmethod
    def timezone_required(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("preferred_time must include a timezone offset")
        return value


class DemandResponse(BaseModel):
    id: int
    from_area_id: int
    to_university_id: int
    preferred_time: datetime | None
    status: RouteDemandStatus
    created_at: datetime


@router.post("", status_code=201, response_model=DemandResponse)
def create_demand(data: DemandCreate, student: User = Depends(require_student),
                  session: Session = Depends(get_session)):
    active_area(session, data.from_area_id)
    active_university(session, data.to_university_id)
    enrolled = session.exec(select(RouteStudents.id).join(Route).where(
        RouteStudents.student_id == student.id,
        RouteStudents.status == RouteStudentStatus.ACTIVE,
        Route.from_area_id == data.from_area_id,
        Route.to_university_id == data.to_university_id,
    )).first()
    if enrolled is not None:
        raise HTTPException(409, "Student already has an active route for this journey")
    routes = session.exec(select(Route).where(
        Route.from_area_id == data.from_area_id,
        Route.to_university_id == data.to_university_id,
        Route.status == RouteStatus.ACTIVE,
    )).all()
    rejected_route_ids = set(session.exec(select(RideRequest.route_id).where(
        RideRequest.student_id == student.id, RideRequest.status == RideRequestStatus.DECLINED
    )).all())
    if any(route.id not in rejected_route_ids and discoverable(route, session) and
           occupancy(session, route.id) < route.capacity
           for route in routes):
        raise HTTPException(409, "A route exists for this journey; route-specific waitlisting is unsupported")
    duplicate = session.exec(select(RouteDemand.id).where(
        RouteDemand.student_id == student.id,
        RouteDemand.from_area_id == data.from_area_id,
        RouteDemand.to_university_id == data.to_university_id,
        RouteDemand.status == RouteDemandStatus.ACTIVE,
    )).first()
    if duplicate is not None:
        raise HTTPException(409, "Active demand already exists for this journey")
    demand = RouteDemand(student_id=student.id, from_area_id=data.from_area_id,
                         to_university_id=data.to_university_id,
                         preferred_time=data.preferred_time)
    try:
        session.add(demand)
        session.commit()
        session.refresh(demand)
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Active demand already exists for this journey") from None
    return demand


@router.get("", response_model=list[DemandResponse])
def own_demands(student: User = Depends(require_student), session: Session = Depends(get_session)):
    return session.exec(select(RouteDemand).where(RouteDemand.student_id == student.id)
                        .order_by(RouteDemand.id.desc())).all()


@router.get("/{demand_id}", response_model=DemandResponse)
def own_demand(demand_id: int, student: User = Depends(require_student),
               session: Session = Depends(get_session)):
    demand = session.get(RouteDemand, demand_id)
    if demand is None or demand.student_id != student.id:
        raise HTTPException(404, "Route demand not found")
    return demand


@router.post("/{demand_id}/cancel", response_model=DemandResponse)
def cancel_demand(demand_id: int, student: User = Depends(require_student),
                  session: Session = Depends(get_session)):
    try:
        demand = session.exec(select(RouteDemand).where(
            RouteDemand.id == demand_id, RouteDemand.student_id == student.id
        ).with_for_update()).first()
        if demand is None:
            raise HTTPException(404, "Route demand not found")
        if demand.status != RouteDemandStatus.ACTIVE:
            raise HTTPException(409, "Only active demand can be cancelled")
        demand.status = RouteDemandStatus.CANCELLED
        session.add(demand)
        session.commit()
        session.refresh(demand)
        return demand
    except Exception:
        session.rollback()
        raise
