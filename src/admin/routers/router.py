from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..DataBase import get_session
from ..models import (ApplicationStatus, Driver_Profile, Route, RouteDemand,
                      RouteStatus, RouteDemandStatus, RouteStudents,
                      RouteStudentStatus, Status, User)

router = APIRouter(prefix="/routes", tags=["Route Management"])

@router.get("/", response_model=List[Route])

def get_routes(status: Optional[RouteStatus] = None , session: Session = Depends(get_session)):

    query = select(Route)
    if status:
        query = query.where(Route.status == status)
    
    routes = session.exec(query).all()
    return routes

@router.patch("/{route_id}/status", response_model=Route)

def update_route_status(route_id: int , new_status: RouteStatus , session: Session = Depends(get_session)):

    route = session.exec(select(Route).where(Route.id == route_id).with_for_update()).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    if new_status == RouteStatus.ACTIVE:
        driver = session.get(User, route.driver_id)
        profile = session.exec(select(Driver_Profile).where(Driver_Profile.Driver_id == route.driver_id)).first()
        if not driver or driver.status != Status.ACTIVE or not profile or profile.verification_status != ApplicationStatus.APPROVED:
            raise HTTPException(status_code=409, detail="An approved active driver is required")
        occupied = len(session.exec(select(RouteStudents).where(
            RouteStudents.route_id == route.id, RouteStudents.status == RouteStudentStatus.ACTIVE
        )).all())
        if occupied >= route.capacity:
            raise HTTPException(status_code=409, detail="No seats are available")
    
    route.status = new_status
    session.add(route)
    session.commit()
    session.refresh(route)
    return route

@router.get("/demands", response_model=List[RouteDemand])

def get_route_demands(status: Optional[RouteDemandStatus] = None , session: Session = Depends(get_session)):

    query = select(RouteDemand)
    if status:
        query = query.where(RouteDemand.status == status)
    
    demands = session.exec(query).all()
    return demands
